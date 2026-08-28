package app.jyoti;

import android.Manifest;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

/**
 * A thin shell around the web app in assets/.
 *
 * The page is served through WebViewAssetLoader on
 * https://appassets.androidplatform.net/ rather than file:///android_asset/.
 * That distinction matters: file:// is not a secure context, so getUserMedia()
 * — the palm scanner's camera — is unavailable there. Nothing leaves the
 * device; that host is served straight out of the APK, and the app holds no
 * INTERNET permission at all.
 */
public class MainActivity extends AppCompatActivity {

    private static final String ORIGIN = "https://appassets.androidplatform.net";

    private WebView web;
    private WebViewAssetLoader loader;
    private ValueCallback<Uri[]> pendingFileCallback;
    private LocalLlm llm;
    private ValueCallback<Uri[]> unusedFileCallbackGuard;   // kept for clarity of intent
    private PermissionRequest pendingCameraRequest;

    private final ActivityResultLauncher<String[]> filePicker =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (pendingFileCallback == null) return;
                pendingFileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
                pendingFileCallback = null;
            });

    private final ActivityResultLauncher<String[]> modelPicker =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (uri == null) { jsEvent("model_error", "cancelled"); return; }
                llm.importFrom(uri,
                        (done, total) -> jsProgress(done, total),
                        () -> jsEvent("model_ready", ""),
                        msg -> jsEvent("model_error", msg));
            });

    private final ActivityResultLauncher<String> cameraPermission =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (pendingCameraRequest == null) return;
                if (granted) pendingCameraRequest.grant(pendingCameraRequest.getResources());
                else pendingCameraRequest.deny();
                pendingCameraRequest = null;
            });

    @Override
    protected void onCreate(@Nullable Bundle saved) {
        super.onCreate(saved);

        loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // the page's service worker fetches through here too, so route it as well
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                    new ServiceWorkerClientCompat() {
                        @Override
                        public WebResourceResponse shouldInterceptRequest(WebResourceRequest req) {
                            return loader.shouldInterceptRequest(req.getUrl());
                        }
                    });
        }

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage holds the profile and the scan
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                // everything lives inside the APK; refuse to navigate anywhere else
                return !ORIGIN.equals(u.getScheme() + "://" + u.getHost());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                boolean wantsCamera = false;
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                }
                if (!wantsCamera) { request.deny(); return; }

                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                    request.grant(request.getResources());
                } else {
                    pendingCameraRequest = request;
                    cameraPermission.launch(Manifest.permission.CAMERA);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = cb;
                try {
                    filePicker.launch(new String[]{"image/*"});
                } catch (Exception e) {
                    pendingFileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) web.setForceDarkAllowed(false);
        web.setBackgroundColor(0xFF0B0A14);
        getWindow().setStatusBarColor(0xFF0B0A14);
        getWindow().setNavigationBarColor(0xFF0F0D20);

        llm = new LocalLlm(this);
        web.addJavascriptInterface(new Bridge(), "JyotiNative");

        if (saved == null) web.loadUrl(ORIGIN + "/index.html");
        else web.restoreState(saved);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /* ---------------- JS bridge ----------------
       The web layer owns the prompt and the conversation; this only exposes
       the model file and the token stream. Everything here is same-origin
       with the page, which is served from inside the APK. */

    private void jsCall(String fn, String jsonArg) {
        final String js = "window." + fn + " && window." + fn + "(" + jsonArg + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private static String q(String s) {
        if (s == null) s = "";
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20 || c == 0x2028 || c == 0x2029) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }

    private void jsEvent(String kind, String detail) {
        jsCall("__jyotiLocalEvent", q(kind) + "," + q(detail));
    }

    private void jsProgress(long done, long total) {
        jsCall("__jyotiLocalProgress", done + "," + total);
    }

    private class Bridge {
        @JavascriptInterface
        public boolean available() { return true; }

        @JavascriptInterface
        public boolean hasModel() { return llm.hasModel(); }

        @JavascriptInterface
        public long modelSize() { return llm.modelSize(); }

        @JavascriptInterface
        public void downloadModel(String url) {
            llm.download(url,
                    (done, total) -> jsProgress(done, total),
                    () -> jsEvent("model_ready", ""),
                    msg -> jsEvent("model_error", msg));
        }

        @JavascriptInterface
        public void pickModel() {
            runOnUiThread(() -> {
                try { modelPicker.launch(new String[]{"*/*"}); }
                catch (Exception e) { jsEvent("model_error", "no file picker available"); }
            });
        }

        @JavascriptInterface
        public boolean deleteModel() { return llm.deleteModel(); }

        @JavascriptInterface
        public void generate(String prompt) {
            llm.generate(prompt,
                    (text, done) -> jsCall("__jyotiLocalDelta", q(text) + "," + done),
                    msg -> jsEvent("gen_error", msg));
        }
    }
}
