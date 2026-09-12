// Executes the real host selection-release implementation without creating a window.
using System;
using System.Reflection;
using System.IO;
using System.Collections.Generic;
using System.Runtime.Serialization;
using System.Web.Script.Serialization;
class NativeUiContractProbe {
 static void Main(string[] args){
  var type=Assembly.LoadFrom(args[0]).GetType("DesktopUiProbe",true);
  var host=FormatterServices.GetUninitializedObject(type);
  var selection=new Dictionary<string,string>();
  type.GetField("selected",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(host,selection);
  var release=type.GetMethod("ReleaseSelection",BindingFlags.Instance|BindingFlags.NonPublic);
  var json=new JavaScriptSerializer();
  for(int i=0;i<300;i++){
   string id=Guid.NewGuid().ToString("N");selection.Add(id,"synthetic-local-path");
   var request=json.Deserialize<Dictionary<string,object>>("{\"ids\":[\""+id+"\"]}");
   release.Invoke(host,new object[]{request});if(selection.Count!=0)throw new Exception("Selection leaked");
  }
  string retained=Guid.NewGuid().ToString("N");selection.Add(retained,"synthetic-local-path");
  foreach(var input in new[]{"{\"ids\":\"bad\"}","{\"ids\":[null]}","{\"ids\":[\"bad\"]}","{\"ids\":[],\"extra\":true}"}){
   bool rejected=false;try{release.Invoke(host,new object[]{json.Deserialize<Dictionary<string,object>>(input)});}catch(TargetInvocationException){rejected=true;}
   if(!rejected||!selection.ContainsKey(retained))throw new Exception("Invalid input mutated selection");
  }
  var select=type.GetMethod("SelectPaths",BindingFlags.Instance|BindingFlags.NonPublic);
  var rejectedSelection=select.Invoke(host,new object[]{new[]{Path.Combine(Path.GetTempPath(),Guid.NewGuid().ToString("N")+".missing"),""}});
  var result=json.Deserialize<Dictionary<string,object>>(json.Serialize(rejectedSelection));
  if(!((bool)result["rejected"])||selection.Count!=1)throw new Exception("Rejected file selection changed native IDs");
  Console.WriteLine("PASS: 300 native selection release cycles; malformed requests preserve existing selection; unreadable files report rejection without retaining IDs.");
 }
}
