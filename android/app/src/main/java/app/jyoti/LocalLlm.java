package app.jyoti;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import com.google.mediapipe.tasks.genai.llminference.LlmInference;
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * On-device language model, so the Pandit chat can run with no API key,
 * no bill and no network.
 *
 * The model file is not shipped in the APK — it is far too large — and no
 * download URL is baked in either. The user points the app at a model, it is
 * fetched once into the app's private storage, and everything after that is
 * local.
 */
public class LocalLlm {

    public interface Progress { void on(long done, long total); }
    public interface Tokens { void delta(String text, boolean done); }
    public interface Fail { void error(String message); }

    private static final String FILE_NAME = "pandit-model.bin";

    private final Context ctx;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private LlmInference engine;
    private final AtomicBoolean busy = new AtomicBoolean(false);

    LocalLlm(Context ctx) { this.ctx = ctx.getApplicationContext(); }

    private File modelFile() { return new File(ctx.getFilesDir(), FILE_NAME); }

    public boolean hasModel() {
        File f = modelFile();
        return f.exists() && f.length() > 1024 * 1024;   // a truncated download is not a model
    }

    public long modelSize() { return hasModel() ? modelFile().length() : 0; }

    public boolean deleteModel() {
        closeEngine();
        return modelFile().delete();
    }

    /** Streams a model file into private storage. Partial downloads are discarded. */
    public void download(final String url, final Progress progress, final Runnable done, final Fail fail) {
        io.execute(new Runnable() {
            @Override public void run() {
                File tmp = new File(ctx.getFilesDir(), FILE_NAME + ".part");
                HttpURLConnection conn = null;
                try {
                    conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(30000);
                    conn.setReadTimeout(60000);
                    conn.connect();
                    int code = conn.getResponseCode();
                    if (code < 200 || code >= 300) throw new Exception("HTTP " + code);

                    long total = conn.getContentLengthLong();
                    InputStream in = conn.getInputStream();
                    OutputStream out = new FileOutputStream(tmp);
                    byte[] buf = new byte[1 << 16];
                    long got = 0;
                    long lastPing = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        got += n;
                        if (got - lastPing > 2_000_000) { lastPing = got; progress.on(got, total); }
                    }
                    out.flush(); out.close(); in.close();

                    if (got < 1024 * 1024) throw new Exception("file too small to be a model");
                    closeEngine();
                    File dest = modelFile();
                    dest.delete();
                    if (!tmp.renameTo(dest)) throw new Exception("could not store the model");
                    progress.on(got, got);
                    main.post(done);
                } catch (Exception e) {
                    tmp.delete();
                    final String msg = e.getMessage() == null ? e.toString() : e.getMessage();
                    main.post(new Runnable() { @Override public void run() { fail.error(msg); } });
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
    }

    /** Copies a model the user already has on the device. */
    public void importFrom(final Uri uri, final Progress progress, final Runnable done, final Fail fail) {
        io.execute(new Runnable() {
            @Override public void run() {
                File tmp = new File(ctx.getFilesDir(), FILE_NAME + ".part");
                try {
                    InputStream in = ctx.getContentResolver().openInputStream(uri);
                    if (in == null) throw new Exception("file could not be opened");
                    OutputStream out = new FileOutputStream(tmp);
                    byte[] buf = new byte[1 << 16];
                    long got = 0, lastPing = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        got += n;
                        if (got - lastPing > 2_000_000) { lastPing = got; progress.on(got, -1); }
                    }
                    out.flush(); out.close(); in.close();
                    if (got < 1024 * 1024) throw new Exception("file too small to be a model");
                    closeEngine();
                    File dest = modelFile();
                    dest.delete();
                    if (!tmp.renameTo(dest)) throw new Exception("could not store the model");
                    progress.on(got, got);
                    main.post(done);
                } catch (Exception e) {
                    tmp.delete();
                    final String msg = e.getMessage() == null ? e.toString() : e.getMessage();
                    main.post(new Runnable() { @Override public void run() { fail.error(msg); } });
                }
            }
        });
    }

    private void closeEngine() {
        if (engine != null) {
            try { engine.close(); } catch (Exception ignored) {}
            engine = null;
        }
    }

    /**
     * Runs one turn. The prompt is already fully assembled by the JS side —
     * the chart context and the conversation live there, as they do for the
     * cloud providers.
     */
    public void generate(final String prompt, final Tokens tokens, final Fail fail) {
        if (!busy.compareAndSet(false, true)) { fail.error("already generating"); return; }
        io.execute(new Runnable() {
            @Override public void run() {
                LlmInferenceSession session = null;
                try {
                    if (!hasModel()) throw new Exception("no model installed");
                    if (engine == null) {
                        LlmInference.LlmInferenceOptions options =
                            LlmInference.LlmInferenceOptions.builder()
                                .setModelPath(modelFile().getAbsolutePath())
                                .setMaxTokens(2048)
                                .build();
                        engine = LlmInference.createFromOptions(ctx, options);
                    }
                    LlmInferenceSession.LlmInferenceSessionOptions so =
                        LlmInferenceSession.LlmInferenceSessionOptions.builder()
                            .setTopK(40)
                            .setTemperature(0.8f)
                            .build();
                    session = LlmInferenceSession.createFromOptions(engine, so);
                    session.addQueryChunk(prompt);

                    final LlmInferenceSession s = session;
                    session.generateResponseAsync(new com.google.mediapipe.tasks.genai.llminference.ProgressListener<String>() {
                        @Override public void run(String partial, boolean done) {
                            tokens.delta(partial == null ? "" : partial, done);
                            if (done) {
                                busy.set(false);
                                try { s.close(); } catch (Exception ignored) {}
                            }
                        }
                    });
                } catch (Throwable e) {
                    busy.set(false);
                    if (session != null) try { session.close(); } catch (Exception ignored) {}
                    final String msg = e.getMessage() == null ? e.toString() : e.getMessage();
                    main.post(new Runnable() { @Override public void run() { fail.error(msg); } });
                }
            }
        });
    }
}
