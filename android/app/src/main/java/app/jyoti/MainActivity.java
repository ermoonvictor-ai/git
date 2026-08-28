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
    private PermissionRequest pendingCameraRequest;

    private final ActivityResultLauncher<String[]> filePicker =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (pendingFileCallback == null) return;
                pendingFileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
                pendingFileCallback = null;
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
}
