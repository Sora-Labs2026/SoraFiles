// Development-only native WebView2 compatibility probe. Not a distributable Desktop app.
using System;
using System.IO;
using System.Drawing;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Net;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

class NativeProbe : Form {
    readonly WebView2 view = new WebView2();
    readonly string root;
    readonly Uri origin;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 48 * 1024 * 1024 };
    NativeProbe(string output, string url) {
        root=Path.GetFullPath(output); Directory.CreateDirectory(root);
        origin=new Uri(url);
        if(origin.Scheme!="https" || origin.Host!="sorafiles-probe.invalid")throw new Exception("Local probe origin required");
        Text="SoraFiles — Native Compatibility Probe"; Size=new Size(1100,800);
        view.Dock=DockStyle.Fill;Controls.Add(view);
        Shown+=async delegate {
            try {
                var options=new CoreWebView2EnvironmentOptions("--no-proxy-server");
                var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(root,"profile"),options);
                await view.EnsureCoreWebView2Async(env);
                view.CoreWebView2.ProcessFailed+=(s,e)=>{File.AppendAllText(Path.Combine(root,"process-failed.txt"),e.ProcessFailedKind.ToString()+"\n");};
                view.CoreWebView2.Settings.AreDevToolsEnabled=false;
                view.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
                // Native transport lets this probe distinguish WebView navigation from engine support.
                view.CoreWebView2.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
                view.CoreWebView2.WebResourceRequested+=async(s,e)=>{
                    File.AppendAllText(Path.Combine(root,"requests.txt"),e.Request.Uri+"\n");
                    var defer=e.GetDeferral();
                    try {
                        if(e.Request.Method!="GET" || !e.Request.Uri.StartsWith(origin.GetLeftPart(UriPartial.Authority)+"/",StringComparison.Ordinal))throw new Exception("Local GET only");
                        using(var client=new WebClient()){
                            client.Proxy=null;
                            var bytes=await client.DownloadDataTaskAsync("http://127.0.0.1:8128"+new Uri(e.Request.Uri).PathAndQuery);
                            var headers="Content-Type: "+client.ResponseHeaders["Content-Type"]+"\r\nCross-Origin-Opener-Policy: same-origin\r\nCross-Origin-Embedder-Policy: require-corp\r\nCross-Origin-Resource-Policy: same-origin\r\n";
                            e.Response=env.CreateWebResourceResponse(new MemoryStream(bytes),200,"OK",headers);
                        }
                    }catch(Exception err){File.AppendAllText(Path.Combine(root,"resource-errors.txt"),err.GetType().Name+"\n");e.Response=env.CreateWebResourceResponse(new MemoryStream(),503,"Unavailable","");}
                    finally{defer.Complete();}
                };
                view.CoreWebView2.NavigationCompleted+=(s,e)=>{
                    File.WriteAllText(Path.Combine(root,"navigation.json"),"{\"success\":"+e.IsSuccess.ToString().ToLower()+",\"status\":\""+e.WebErrorStatus+"\"}");
                    var timer=new Timer();timer.Interval=5000;timer.Tick+=async(ts,te)=>{try{File.WriteAllText(Path.Combine(root,"page-state.json"),await view.CoreWebView2.ExecuteScriptAsync("JSON.stringify({text:document.body.innerText,isolation:crossOriginIsolated})"));}catch{timer.Stop();}};timer.Start();
                };
                view.CoreWebView2.NewWindowRequested+=(s,e)=>{e.Handled=true;};
                view.CoreWebView2.PermissionRequested+=(s,e)=>{e.State=CoreWebView2PermissionState.Deny;};
                view.CoreWebView2.NavigationStarting+=(s,e)=>{var allowed=e.Uri=="about:blank" || e.Uri.StartsWith(origin.GetLeftPart(UriPartial.Authority)+"/",StringComparison.Ordinal);File.AppendAllText(Path.Combine(root,"navigation-start.txt"),e.Uri+" allowed="+allowed+" expected="+origin.GetLeftPart(UriPartial.Authority)+"/\n");if(!allowed)e.Cancel=true;};
                view.CoreWebView2.WebMessageReceived+=(s,e)=>{
                    if(!e.Source.StartsWith(origin.GetLeftPart(UriPartial.Authority)+"/",StringComparison.Ordinal))return;
                    try {
                        var data=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);
                        var kind=(string)data["type"];
                        if(kind=="output"){
                            var id=(string)data["id"];
                            var names=new Dictionary<string,string>{{"pdf","pdf.pdf"},{"image","image.png"},{"ocr","ocr.txt"},{"office","office.pdf"},{"background","background.png"}};
                            if(!names.ContainsKey(id))return;
                            var bytes=Convert.FromBase64String((string)data["data"]);
                            if(bytes.Length>32*1024*1024)throw new Exception("Output bound");
                            File.WriteAllBytes(Path.Combine(root,names[id]),bytes);
                        } else if(kind=="complete") {
                            File.WriteAllText(Path.Combine(root,"results.json"),e.WebMessageAsJson);
                            view.Dispose();Close();
                        }
                    }catch {File.WriteAllText(Path.Combine(root,"bridge-error.txt"),"Invalid probe output");Close();}
                };
                view.CoreWebView2.Navigate(origin.AbsoluteUri);
            }catch(Exception e){File.WriteAllText(Path.Combine(root,"startup-error.txt"),e.GetType().Name+": "+e.Message);Close();}
        };
    }
    [STAThread] static void Main(string[] args){
        if(args.Length!=2)return;
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new NativeProbe(args[0],args[1]));
    }
}
