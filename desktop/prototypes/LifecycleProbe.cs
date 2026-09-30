// Windows-only architecture experiment. No shell/startup registration and no processing.
using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

class LifecycleProbe : ApplicationContext {
    readonly string root;
    readonly NotifyIcon tray;
    readonly List<object> samples=new List<object>();
    Form window;
    WebView2 view;
    bool quitting;
    LifecycleProbe(string output){
        root=Path.GetFullPath(output);Directory.CreateDirectory(root);
        var menu=new ContextMenuStrip();
        menu.Items.Add("Quit SoraFiles probe",null,(s,e)=>Quit());
        tray=new NotifyIcon{Icon=SystemIcons.Application,Text="SoraFiles lifecycle probe",ContextMenuStrip=menu,Visible=true};
        var start=new Timer{Interval=100};start.Tick+=async(s,e)=>{start.Stop();start.Dispose();await Run();};start.Start();
    }
    object Sample(string stage){var p=Process.GetCurrentProcess();p.Refresh();return new {stage,workingSet=p.WorkingSet64,privateBytes=p.PrivateMemorySize64,cpuMs=p.TotalProcessorTime.TotalMilliseconds,uiAlive=view!=null&&!view.IsDisposed};}
    async Task Run(){try{
        samples.Add(Sample("helper-before-ui"));
        for(int cycle=0;cycle<2;cycle++){
            if(quitting)return;
            window=new Form{Text="SoraFiles lifecycle probe",Size=new Size(800,600),ShowInTaskbar=false,Opacity=0};
            view=new WebView2{Dock=DockStyle.Fill};window.Controls.Add(view);
            // Closing disposes the actual WebView; ApplicationContext retains only native helper state.
            window.FormClosed+=(s,e)=>{if(view!=null){view.Dispose();view=null;}window=null;};
            window.Show();
            var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(root,"profile"));
            await view.EnsureCoreWebView2Async(environment);
            var loaded=new TaskCompletionSource<bool>();
            view.CoreWebView2.NavigationCompleted+=(s,e)=>loaded.TrySetResult(e.IsSuccess);
            view.CoreWebView2.NavigateToString("<!doctype html><title>SoraFiles probe</title><h1>Local desktop UI lifecycle</h1>");
            if(await Task.WhenAny(loaded.Task,Task.Delay(15000))!=loaded.Task || !await loaded.Task)throw new Exception("Local view failed");
            int browserId=(int)view.CoreWebView2.BrowserProcessId;
            samples.Add(Sample("ui-open-"+cycle));
            window.Close();
            bool exited=false;
            for(int i=0;i<100;i++){
                try{using(var p=Process.GetProcessById(browserId)){exited=p.HasExited;}}catch(ArgumentException){exited=true;}
                if(exited)break;await Task.Delay(100);
            }
            GC.Collect();GC.WaitForPendingFinalizers();GC.Collect();
            samples.Add(new {stage="browser-after-close-"+cycle,browserExited=exited,browserId});
            if(!exited)throw new Exception("Browser remained after closing window");
            samples.Add(Sample("helper-idle-start-"+cycle));await Task.Delay(5000);samples.Add(Sample("helper-idle-end-"+cycle));
        }
        File.WriteAllText(Path.Combine(root,"lifecycle.json"),new JavaScriptSerializer().Serialize(new {status="PASS",samples}));
    }catch(Exception error){File.WriteAllText(Path.Combine(root,"lifecycle.json"),new JavaScriptSerializer().Serialize(new {status="FAIL",error=error.Message,samples}));}finally{Quit();}}
    void Quit(){if(quitting)return;quitting=true;if(window!=null)window.Close();if(view!=null)view.Dispose();tray.Visible=false;tray.Dispose();ExitThread();}
    [STAThread] static void Main(string[] args){if(args.Length!=1)return;Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new LifecycleProbe(args[0]));}
}
