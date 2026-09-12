using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;

class StorageProbe {
    static void Require(bool condition,string message){if(!condition)throw new Exception(message);}
    static string Save(string root,string name,byte[] bytes,Func<Stream,bool> validator,CancellationToken token){return WindowsFileBoundary.Save(root,name,s=>s.Write(bytes,0,bytes.Length),validator,token);}
    static void Main(string[] args){if(args.Length!=1)return;var root=Path.GetFullPath(args[0]);Directory.CreateDirectory(root);var checks=new List<string>();
        try{
            var run=Path.Combine(root,"run-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(run);
            byte[] original=Encoding.UTF8.GetBytes("original fixture"),output=Encoding.UTF8.GetBytes("validated result");File.WriteAllBytes(Path.Combine(run,"source.txt"),original);
            var tasks=Enumerable.Range(0,12).Select(i=>Task.Run(()=>Save(run,"source.txt",output,s=>s.Length==output.Length,CancellationToken.None))).ToArray();Task.WaitAll(tasks);
            Require(tasks.Select(t=>t.Result).Distinct().Count()==12,"Concurrent filenames collided");Require(File.ReadAllBytes(Path.Combine(run,"source.txt")).SequenceEqual(original),"Original changed");checks.Add("12 concurrent native writes: originals preserved and collision names unique");
            bool failed=false;try{Save(run,"invalid.txt",output,s=>false,CancellationToken.None);}catch(IOException){failed=true;}Require(failed&&!File.Exists(Path.Combine(run,"invalid.txt")),"Invalid output published");checks.Add("Failed validation never published");
            var cancel=new CancellationTokenSource();failed=false;try{Save(run,"cancel.txt",output,s=>{cancel.Cancel();return true;},cancel.Token);}catch(OperationCanceledException){failed=true;}Require(failed&&!File.Exists(Path.Combine(run,"cancel.txt")),"Cancelled output published");checks.Add("Cancellation after staging never published");
            var pinned=Path.Combine(run,"pinned");Directory.CreateDirectory(pinned);bool moveBlocked=false;
            Save(pinned,"safe.txt",output,s=>{try{Directory.Move(pinned,Path.Combine(run,"moved"));}catch(IOException){moveBlocked=true;}return true;},CancellationToken.None);
            Require(moveBlocked&&Directory.Exists(pinned),"Output ancestor could be moved while writing");checks.Add("Native directory pin denied ancestor rename during validation");
            Require(!Directory.GetFiles(run,"*.tmp",SearchOption.AllDirectories).Any(),"Staging files remain");checks.Add("No temporary outputs remain");
            byte[] secret=new byte[64];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(secret);
            byte[] entropy=Encoding.UTF8.GetBytes("SoraFiles.Desktop.DeviceIdentity.v1"),encrypted=ProtectedData.Protect(secret,entropy,DataProtectionScope.CurrentUser);
            var protectedPath=Save(run,"identity.dpapi",encrypted,s=>s.Length==encrypted.Length,CancellationToken.None);
            Require(ProtectedData.Unprotect(File.ReadAllBytes(protectedPath),entropy,DataProtectionScope.CurrentUser).SequenceEqual(secret),"DPAPI roundtrip failed");checks.Add("OS current-user DPAPI protected bytes survive disk roundtrip");
            encrypted[encrypted.Length/2]^=1;failed=false;try{ProtectedData.Unprotect(encrypted,entropy,DataProtectionScope.CurrentUser);}catch(CryptographicException){failed=true;}Require(failed,"Tampered protected data accepted");Array.Clear(secret,0,secret.Length);checks.Add("DPAPI tampering rejected");
            File.WriteAllText(Path.Combine(root,"storage.json"),new JavaScriptSerializer().Serialize(new {status="PASS",checks,limits=new[]{"Windows local filesystem prototype only","No other-user/machine DPAPI test","No persistent trusted-clock integration","No installer or production bridge integration"}}));
        }catch(Exception error){File.WriteAllText(Path.Combine(root,"storage.json"),new JavaScriptSerializer().Serialize(new {status="FAIL",error=error.ToString(),checks}));Environment.ExitCode=1;}
    }
}
