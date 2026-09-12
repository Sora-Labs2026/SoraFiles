// Development host for the independent Desktop interface. No paid processing is enabled.
using System;
using System.IO;
using System.Linq;
using System.Drawing;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

class DesktopUiProbe : ApplicationContext {
    const string Origin="https://desktop.sorafiles.invalid/";
    readonly string assets,output;
    readonly bool captureOnly;
    readonly NotifyIcon tray;
    readonly Icon appIcon;
    readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=65536};
    readonly Dictionary<string,string> selected=new Dictionary<string,string>();
    string outputMode="source",theme="system",customFolder;
    Form window;WebView2 view;bool opening,quitting;
    DesktopUiProbe(string folder,string evidence,bool capture){
        assets=Path.GetFullPath(folder);output=Path.GetFullPath(evidence);captureOnly=capture;Directory.CreateDirectory(output);
        appIcon=new Icon(Path.Combine(assets,"favicon.ico"));
        var menu=new ContextMenuStrip();menu.Items.Add("Open SoraFiles",null,async(s,e)=>await Open());menu.Items.Add("Quit SoraFiles",null,(s,e)=>Quit());
        tray=new NotifyIcon{Icon=appIcon,Text="SoraFiles Desktop development build",ContextMenuStrip=menu,Visible=!capture};tray.DoubleClick+=async(s,e)=>await Open();
        var timer=new Timer{Interval=100};timer.Tick+=async(s,e)=>{timer.Stop();timer.Dispose();await Open();};timer.Start();
    }
    object State(){return new {platform="windows",license="not-activated",output=outputMode,startup=false,theme,version="Development build"};}
    async Task Open(){if(quitting||opening)return;if(window!=null){window.Show();window.Activate();return;}opening=true;
        try{
            window=new Form{Icon=appIcon,Text="SoraFiles Desktop (development)",Size=new Size(1180,900),MinimumSize=new Size(760,600),StartPosition=FormStartPosition.CenterScreen,ShowInTaskbar=!captureOnly,Opacity=captureOnly?0:1};
            view=new WebView2{Dock=DockStyle.Fill};window.Controls.Add(view);window.FormClosed+=(s,e)=>{view.Dispose();view=null;window=null;selected.Clear();};window.Show();
            var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(output,"profile"));await view.EnsureCoreWebView2Async(env);
            var core=view.CoreWebView2;core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;
            core.SetVirtualHostNameToFolderMapping("desktop.sorafiles.invalid",assets,CoreWebView2HostResourceAccessKind.Deny);
            core.NavigationStarting+=(s,e)=>{if(!e.Uri.StartsWith(Origin,StringComparison.Ordinal))e.Cancel=true;};core.NewWindowRequested+=(s,e)=>e.Handled=true;core.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
            core.DownloadStarting+=(s,e)=>e.Cancel=true;
            core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
            core.WebResourceRequested+=(s,e)=>{if(!e.Request.Uri.StartsWith(Origin,StringComparison.Ordinal))e.Response=env.CreateWebResourceResponse(new MemoryStream(),403,"Blocked","");};
            core.WebMessageReceived+=Message;
            core.NavigationCompleted+=async(s,e)=>{
                if(!captureOnly)return;
                try{if(!e.IsSuccess)throw new Exception("Native UI navigation failed");await Task.Delay(1500);
                    using(var stream=File.Create(Path.Combine(output,"home.png")))await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
                    File.WriteAllText(Path.Combine(output,"ui-state.json"),await core.ExecuteScriptAsync("JSON.stringify({title:document.title,heading:document.querySelector('h1')?.textContent,tools:document.querySelectorAll('[data-tool]').length,overflow:document.documentElement.scrollWidth>innerWidth,errors:document.querySelector('[role=alert]')?.textContent||null})"));
                    // Exercise actual WebView zoom at the minimum native window size.
                    window.Size=new Size(760,600);view.ZoomFactor=2;await Task.Delay(250);
                    foreach(string page in new[]{"home","tools","license","settings","updates"}){
                        await core.ExecuteScriptAsync("document.querySelector('[data-page="+page+"]').click()");await Task.Delay(100);
                        if(await core.ExecuteScriptAsync("document.documentElement.scrollWidth>innerWidth")!="false")throw new Exception("Native zoom overflow: "+page);
                    }
                    await core.ExecuteScriptAsync("document.querySelector('[data-page=settings]').click()");
                    using(var stream=File.Create(Path.Combine(output,"settings-native-200.png")))await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
                    File.WriteAllText(Path.Combine(output,"zoom-state.json"),await core.ExecuteScriptAsync("JSON.stringify({zoom:2,viewport:[innerWidth,innerHeight],checkedScreens:5,overflow:document.documentElement.scrollWidth>innerWidth,quitVisible:getComputedStyle(document.querySelector('[data-action=quit]')).display!=='none'})"));
                }catch(Exception error){File.WriteAllText(Path.Combine(output,"error.txt"),error.Message);}finally{Quit();}
            };
            core.Navigate(Origin+"index.html");
        }catch(Exception error){File.WriteAllText(Path.Combine(output,"startup-error.txt"),error.Message);Quit();}finally{opening=false;}
    }
    object SelectPaths(IEnumerable<string> paths){var result=new List<object>();int rejected=0;foreach(var path in paths.Take(257)){
        try{var full=Path.GetFullPath(path);if(full.StartsWith(@"\\")){rejected++;continue;}var info=new FileInfo(full);if(!info.Exists||info.Length==0||info.Length>512L*1024*1024||(info.Attributes&FileAttributes.ReparsePoint)!=0){rejected++;continue;}
            var existing=selected.FirstOrDefault(p=>String.Equals(p.Value,full,StringComparison.OrdinalIgnoreCase));string id=existing.Key??Guid.NewGuid().ToString("N");if(selected.Count>=256&&existing.Key==null){rejected++;continue;}
            string format=null;byte[] head=new byte[16];using(var stream=File.Open(full,FileMode.Open,FileAccess.Read,FileShare.Read))stream.Read(head,0,head.Length);
            if(System.Text.Encoding.ASCII.GetString(head,0,5)=="%PDF-")format="PDF";else if(head[0]==137&&head[1]==80&&head[2]==78&&head[3]==71)format="PNG";else if(head[0]==255&&head[1]==216&&head[2]==255)format="JPG";
            selected[id]=full;
            result.Add(new {id,name=info.Name,format,validated=format!=null,bytes=info.Length});
        }catch(IOException){rejected++;}catch(UnauthorizedAccessException){rejected++;}catch(ArgumentException){rejected++;}
    }return new {files=result,rejected=rejected>0};}
    object ReleaseSelection(Dictionary<string,object> args){
        if(args.Count!=1||!args.ContainsKey("ids")||!(args["ids"] is System.Collections.IList))throw new Exception("Invalid file selection.");
        var ids=(System.Collections.IList)args["ids"];
        if(ids.Count>256||ids.Cast<object>().Any(value=>!(value is string)||((string)value).Length!=32))throw new Exception("Invalid file selection.");
        foreach(string selectionId in ids)selected.Remove(selectionId);
        return new {released=true};
    }
    void Message(object sender,CoreWebView2WebMessageReceivedEventArgs e){
        if(!e.Source.StartsWith(Origin,StringComparison.Ordinal)||quitting)return;string id=null;
        try{var request=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);
            if(request.Count!=4||!request.ContainsKey("protocol")||Convert.ToInt32(request["protocol"])!=1)return;
            id=(string)request["id"];Guid parsed;if(!Guid.TryParse(id,out parsed))return;
            string method=(string)request["method"];var args=(Dictionary<string,object>)request["params"];object result;
            switch(method){
                case "getState":result=State();break;
                case "selectFiles":using(var dialog=new OpenFileDialog{Multiselect=true,Title="Choose files for SoraFiles",CheckFileExists=true,RestoreDirectory=true,Filter="Documents and images|*.pdf;*.jpg;*.jpeg;*.png;*.webp;*.heic;*.heif;*.docx;*.xlsx;*.tif;*.tiff;*.psd|All files|*.*"}){result=dialog.ShowDialog(window)==DialogResult.OK?SelectPaths(dialog.FileNames):new object[0];}break;
                case "dropFiles":if(args.Count!=0||e.AdditionalObjects==null)throw new Exception("Use Choose files to select files.");result=SelectPaths(e.AdditionalObjects.OfType<CoreWebView2File>().Select(f=>f.Path));break;
                case "releaseSelection":result=ReleaseSelection(args);break;
                case "saveSettings":
                    if(args.Count!=1)throw new Exception("Choose one setting to change.");
                    if(args.ContainsKey("startup"))throw new Exception("Sign-in quick actions are not installed in this development build.");
                    if(args.ContainsKey("output")){var value=(string)args["output"];if(!new[]{"source","downloads","custom","ask"}.Contains(value))throw new Exception("Choose a valid output location.");outputMode=value;}
                    else if(args.ContainsKey("theme")){var value=(string)args["theme"];if(!new[]{"system","light","dark"}.Contains(value))throw new Exception("Choose a valid appearance.");theme=value;}else throw new Exception("Unknown setting.");result=State();break;
                case "chooseFolder":using(var dialog=new FolderBrowserDialog{Description="Choose where SoraFiles saves results",SelectedPath=customFolder??Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)}){bool accepted=dialog.ShowDialog(window)==DialogResult.OK;if(accepted)customFolder=dialog.SelectedPath;result=new {selected=accepted};}break;
                case "startTrial":throw new Exception("Trial activation is not configured in this development build.");
                case "activate":throw new Exception("License activation is not configured in this development build.");
                case "checkUpdates":result=new {message="No Desktop releases are published yet."};break;
                case "quit":Reply(id,true,new {quitting=true},null);Quit();return;
                default:throw new Exception("This action is not available in this development build.");
            }Reply(id,true,result,null);
        }catch(Exception error){if(id!=null)Reply(id,false,null,error is InvalidCastException||error is KeyNotFoundException||error is ArgumentException?"Invalid desktop request.":error.Message);}
    }
    void Reply(string id,bool ok,object result,string error){if(view!=null&&!view.IsDisposed)view.CoreWebView2.PostWebMessageAsJson(json.Serialize(new {protocol=1,id,ok,result,error}));}
    void Quit(){if(quitting)return;quitting=true;if(window!=null)window.Close();tray.Visible=false;tray.Dispose();appIcon.Dispose();ExitThread();}
    [STAThread]static void Main(string[] args){if(args.Length<2)return;Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new DesktopUiProbe(args[0],args[1],args.Contains("--capture")));}
}
