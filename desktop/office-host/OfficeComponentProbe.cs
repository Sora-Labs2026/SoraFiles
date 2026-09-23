// Development-only, synthetic offline engine diagnostic. Not a licensed job host.
using System;
using System.IO;
using System.Drawing;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections;
using System.Collections.Generic;
using System.Security.Cryptography;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

class OfficeComponentProbe : Form {
 const string Origin="https://sorafiles-office.invalid";
 readonly WebView2 view=new WebView2();
 readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=48*1024*1024};
 readonly Dictionary<string,byte[]> resources=new Dictionary<string,byte[]>(StringComparer.Ordinal);
 readonly HashSet<string> outputs=new HashSet<string>();
 readonly string evidence;
 readonly Timer deadline=new Timer();
 int denied; bool finished;
 OfficeComponentProbe(string manifest,string destination) {
  evidence=Path.GetFullPath(destination);
  if(!Directory.Exists(evidence))throw new Exception("Existing diagnostic directory required");
  var config=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(manifest));
  long total=0;
  foreach(Dictionary<string,object> item in (ArrayList)config["resources"]){
   string url=(string)item["url"],path=(string)item["path"];
   if(!url.StartsWith("/",StringComparison.Ordinal)||url.Contains("..")||url.Contains("%")||url.Contains("?")||resources.ContainsKey(Origin+url))throw new Exception("Invalid resource identity");
   var info=new FileInfo(path);
   if(!info.Exists||(info.Attributes&FileAttributes.ReparsePoint)!=0||info.Length>170*1024*1024||(total+=info.Length)>300*1024*1024)throw new Exception("Resource bounds");
   byte[] bytes=File.ReadAllBytes(path);
   using(var sha=SHA256.Create())if(BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant()!=(string)item["sha256"])throw new Exception("Resource integrity");
   resources.Add(Origin+url,bytes);
  }
  Text="SoraFiles Office diagnostic";Size=new Size(1180,900);ShowInTaskbar=false;Opacity=0;
  view.Dock=DockStyle.Fill;Controls.Add(view);
  deadline.Interval=180000;deadline.Tick+=(s,e)=>Finish(false,"timeout");deadline.Start();
  Shown+=async delegate {
   try {
    var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(evidence,"profile"),new CoreWebView2EnvironmentOptions("--disable-background-networking --no-proxy-server"));
    await view.EnsureCoreWebView2Async(env);
    var core=view.CoreWebView2;
    core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;
    core.Settings.AreDefaultScriptDialogsEnabled=false;
    core.NewWindowRequested+=(s,e)=>{e.Handled=true;denied++;};
    core.PermissionRequested+=(s,e)=>{e.State=CoreWebView2PermissionState.Deny;denied++;};
    core.DownloadStarting+=(s,e)=>{e.Cancel=true;denied++;};
    core.ProcessFailed+=(s,e)=>Finish(false,"webview-process");
    core.NavigationStarting+=(s,e)=>{if(e.Uri!=Origin+"/index.html"){e.Cancel=true;denied++;}};
    core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All,CoreWebView2WebResourceRequestSourceKinds.All);
    core.WebResourceRequested+=(s,e)=>{
     byte[] bytes;
     if(e.Request.Method!="GET"||!resources.TryGetValue(e.Request.Uri,out bytes)){
      denied++;e.Response=env.CreateWebResourceResponse(new MemoryStream(),403,"Blocked", "Cache-Control: no-store\r\n");return;
     }
     string extension=Path.GetExtension(new Uri(e.Request.Uri).AbsolutePath);
     string mime=extension==".html"?"text/html":extension==".mjs"||extension==".js"?"text/javascript":extension==".wasm"?"application/wasm":extension==".metadata"?"application/json":"application/octet-stream";
     string headers="Content-Type: "+mime+"\r\nCache-Control: no-store\r\nCross-Origin-Opener-Policy: same-origin\r\nCross-Origin-Embedder-Policy: require-corp\r\nCross-Origin-Resource-Policy: same-origin\r\nX-Content-Type-Options: nosniff\r\n"+
      "Content-Security-Policy: default-src 'none'; script-src 'self' blob: data: 'unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'\r\n";
     e.Response=env.CreateWebResourceResponse(new MemoryStream(bytes,false),200,"OK",headers);
    };
    core.WebMessageReceived+=(s,e)=>{
     if(e.Source!=Origin+"/index.html")return;
     try{
      var message=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);
      string kind=(string)message["type"];
      if(kind=="output"){
       string id=(string)message["id"],encoded=(string)message["data"];
       if((id!="writer"&&id!="calc")||outputs.Contains(id)||encoded.Length>44739244)throw new Exception("Invalid output");
       byte[] bytes=Convert.FromBase64String(encoded);
       if(bytes.Length<5||bytes.Length>32*1024*1024||System.Text.Encoding.ASCII.GetString(bytes,0,5)!="%PDF-")throw new Exception("Invalid PDF");
       using(var file=new FileStream(Path.Combine(evidence,id+".pdf"),FileMode.CreateNew,FileAccess.Write,FileShare.None))file.Write(bytes,0,bytes.Length);
       outputs.Add(id);
      }else if(kind=="complete")Finish(outputs.Count==2&&(bool)message["isolated"],"complete");
      else if(kind=="failed"){
       string phase=message.ContainsKey("phase")?message["phase"] as string:null;
       var phases=new HashSet<string>{"isolation","network-policy","initialization","writer-fixture","calc-fixture","writer-conversion","calc-conversion","writer-import","calc-import","writer-export","calc-export","writer-timeout","calc-timeout"};
       Finish(false,phase!=null&&phases.Contains(phase)?phase:"invalid-failure");
      }
      else throw new Exception("Unknown message");
     }catch{Finish(false,"bridge");}
    };
    core.Navigate(Origin+"/index.html");
   }catch{Finish(false,"startup");}
  };
 }
 void Finish(bool success,string stage){
  if(finished)return;finished=true;deadline.Stop();
  File.WriteAllText(Path.Combine(evidence,"native-result.json"),json.Serialize(new {status=success?"CONVERTED":"FAILED",stage=stage,outputs=outputs.Count,deniedRequests=denied,scope="Synthetic local Office component only; no licensed processing route or installer certification"}));
  Environment.ExitCode=success?0:1;view.Dispose();Close();
 }
 [STAThread]static void Main(string[] args){
  if(args.Length!=2){Environment.ExitCode=2;return;}
  try{Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new OfficeComponentProbe(args[0],args[1]));}
  catch{Environment.ExitCode=2;}
 }
}
