package com.taylorarchibald.menovation;

import android.app.Activity;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Thin WebView shell for the Menovation web app on Fire TV.
 *  - Loads the hosted app (BuildConfig.APP_URL).
 *  - If the server redirects to the SSO login page, shows the local QR pairing screen instead.
 *  - Routes BACK to the web app (window.mvnTvBack) and only exits when the app is at its root.
 *  - D-pad keys reach the page natively as KeyboardEvents (ArrowUp/Down/Left/Right/Enter).
 */
public class MainActivity extends Activity {
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout root;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " MenovationTV");
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return maybePair(v, r.getUrl());
            }
            @Override
            public void onPageStarted(WebView v, String url, Bitmap icon) {
                maybePair(v, Uri.parse(url));
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                CookieManager.getInstance().flush(); // persist the SSO session across app restarts
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                customView = view; customViewCallback = cb;
                root.addView(view);
                web.setVisibility(View.GONE);
            }
            @Override
            public void onHideCustomView() { hideCustomView(); }
        });

        web.loadUrl(BuildConfig.APP_URL);
    }

    /** Intercept redirects to the SSO login page and show the QR pairing page instead. */
    private boolean maybePair(WebView v, Uri u) {
        String path = u.getPath() == null ? "" : u.getPath();
        if (path.startsWith("/sso/login")) {
            String api = u.getScheme() + "://" + u.getHost();
            String ret = u.getQueryParameter("return_url");
            Uri.Builder pair = Uri.parse("file:///android_asset/pair.html").buildUpon()
                    .appendQueryParameter("api", api)
                    .appendQueryParameter("return", ret == null ? BuildConfig.APP_URL : ret)
                    .appendQueryParameter("login", u.toString());
            v.stopLoading();
            v.loadUrl(pair.build().toString());
            return true;
        }
        return false;
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        web.setVisibility(View.VISIBLE);
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent e) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            e.startTracking();
            return true;
        }
        return super.onKeyDown(keyCode, e);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent e) {
        if (keyCode == KeyEvent.KEYCODE_BACK && e.isTracking() && !e.isCanceled()) {
            handleBackPress();
            return true;
        }
        return super.onKeyUp(keyCode, e);
    }

    @Override
    public void onBackPressed() {
        handleBackPress();
    }

    private void handleBackPress() {
        if (customView != null) {
            hideCustomView();
            return;
        }
        String url = web.getUrl();
        if (url != null && url.startsWith("file:///android_asset/pair.html")) {
            finish();
            return;
        }
        web.evaluateJavascript("(function(){return window.mvnTvBack ? window.mvnTvBack() : false;})()", value -> {
            if (!"true".equals(value)) {
                finish();
            }
        });
    }

    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
}
