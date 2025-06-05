package inimatic.loginwv;

import android.app.Dialog;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.CookieManager;
import android.webkit.WebSettings;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONException;

public class LoginWV extends CordovaPlugin {

  	private WebView webViewRef;

  	@Override
  	public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
		LOG.d("LoginWV", "execute");
    	if ("login".equals(action)) {
			// final String url = args.getString(0);
			// final String checkLoginJs = args.getString(1);
			login(args.getString(0), args.getString(1), callbackContext);
			return true;
    	}
    	return false;
  	}

  	private void login(String loginUrl, String checkLoginJs, CallbackContext callbackContext) {
    	cordova.getActivity().runOnUiThread(() -> {
			LOG.d("LoginWV", "Opening URL: " + loginUrl);
			Dialog dialog = new Dialog(cordova.getContext());
			WebView webView = new WebView(cordova.getContext());
			webViewRef = webView;

			WebSettings settings = webView.getSettings();
			settings.setJavaScriptEnabled(true);
			settings.setDomStorageEnabled(true);

			webView.setWebViewClient(new WebViewClient() {
				@Override
				public void onPageFinished(WebView view, String url) {
					super.onPageFinished(view, url);

					view.evaluateJavascript(checkLoginJs, result -> {
						if (result != null && result.equals("true")) {
							CookieManager cm = CookieManager.getInstance();
							cm.acceptCookie(true)
							cm.acceptThirdPartyCookies(view)
							String cookies = cm.getCookie(url);
							// dialog.dismiss();
							callbackContext.success(cookies != null ? cookies : "");
						}
					});
				}
			});

			webView.loadUrl(loginUrl);
			dialog.setContentView(webView);
			dialog.show();
		});
  	}
}


