// Native filesystem architecture prototype. Windows local volumes only.
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public sealed class WindowsDirectoryPin : IDisposable {
    readonly List<SafeFileHandle> handles=new List<SafeFileHandle>();
    public readonly string PathName;
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool GetFileInformationByHandleEx(SafeFileHandle file,int informationClass,out Attributes info,uint size);
    [StructLayout(LayoutKind.Sequential)]struct Attributes {public uint flags;public uint tag;}
    public WindowsDirectoryPin(string folder){
        if(String.IsNullOrEmpty(folder)||folder.StartsWith(@"\\")||folder.Length<3||folder[1]!=':'||folder[2]!='\\')throw new IOException("Local absolute output folder required");
        PathName=Path.GetFullPath(folder);
        try{var cursor=Path.GetPathRoot(PathName);Pin(cursor);foreach(var part in PathName.Substring(cursor.Length).Split(new[]{'\\'},StringSplitOptions.RemoveEmptyEntries)){cursor=Path.Combine(cursor,part);Pin(cursor);}}catch{Dispose();throw;}
    }
    void Pin(string path){
        // Sharing excludes DELETE: every opened ancestor remains in place while pinned.
        var handle=CreateFile(path,0,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
        if(handle.IsInvalid){handle.Dispose();throw new Win32Exception(Marshal.GetLastWin32Error());}
        handles.Add(handle);Attributes info;
        if(!GetFileInformationByHandleEx(handle,9,out info,8))throw new Win32Exception(Marshal.GetLastWin32Error());
        if((info.flags&0x400)!=0||(info.flags&0x10)==0)throw new IOException("Reparse points are not supported output folders");
    }
    public void Dispose(){for(int i=handles.Count-1;i>=0;i--)handles[i].Dispose();handles.Clear();}
}

public static class WindowsFileBoundary {
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool SetFileInformationByHandle(SafeFileHandle file,int informationClass,IntPtr information,uint size);
    static void ValidateName(string name){
        if(String.IsNullOrEmpty(name)||name!=Path.GetFileName(name)||name.IndexOfAny(Path.GetInvalidFileNameChars())>=0||name.EndsWith(".")||name.EndsWith(" ")||name.Length>180)throw new IOException("Invalid output name");
        var stem=name.Split('.')[0].ToUpperInvariant();if(stem=="CON"||stem=="PRN"||stem=="AUX"||stem=="NUL"||System.Text.RegularExpressions.Regex.IsMatch(stem,@"^(COM|LPT)[1-9]$"))throw new IOException("Reserved output name");
    }
    static int Rename(SafeFileHandle file,string target){
        byte[] name=Encoding.Unicode.GetBytes(target);int rootOffset=IntPtr.Size==8?8:4,lengthOffset=rootOffset+IntPtr.Size,nameOffset=lengthOffset+4;
        var memory=Marshal.AllocHGlobal(nameOffset+name.Length+2);
        try{for(int i=0;i<nameOffset+name.Length+2;i++)Marshal.WriteByte(memory,i,0);
            // ReplaceIfExists remains FALSE. Rename the already-open file by its handle.
            Marshal.WriteIntPtr(memory,rootOffset,IntPtr.Zero);Marshal.WriteInt32(memory,lengthOffset,name.Length);Marshal.Copy(name,0,IntPtr.Add(memory,nameOffset),name.Length);
            return SetFileInformationByHandle(file,3,memory,(uint)(nameOffset+name.Length))?0:Marshal.GetLastWin32Error();
        }finally{Marshal.FreeHGlobal(memory);}
    }
    static void DeleteOnClose(SafeFileHandle file){var memory=Marshal.AllocHGlobal(4);try{Marshal.WriteInt32(memory,1);if(!SetFileInformationByHandle(file,4,memory,4))throw new Win32Exception(Marshal.GetLastWin32Error());}finally{Marshal.FreeHGlobal(memory);}}
    public static string Save(string folder,string preferredName,Action<Stream> write,Func<Stream,bool> validate,CancellationToken cancellation){
        ValidateName(preferredName);if(write==null||validate==null)throw new ArgumentException("Writer and validator required");cancellation.ThrowIfCancellationRequested();
        using(var pin=new WindowsDirectoryPin(folder)){
            string temp=Path.Combine(pin.PathName,".sorafiles-"+Guid.NewGuid().ToString("N")+".tmp");
            // The open file denies other writers/deleters until validated and renamed.
            var handle=CreateFile(temp,0xC0010000,1,IntPtr.Zero,1,0x100,IntPtr.Zero);
            if(handle.IsInvalid){handle.Dispose();throw new Win32Exception(Marshal.GetLastWin32Error());}
            using(var stream=new FileStream(handle,FileAccess.ReadWrite)){
                bool published=false;
                try{write(stream);stream.Flush(true);if(stream.Length<1)throw new IOException("Empty output");stream.Position=0;
                    if(!validate(stream))throw new IOException("Output validation failed");cancellation.ThrowIfCancellationRequested();
                    var stem=Path.GetFileNameWithoutExtension(preferredName);var extension=Path.GetExtension(preferredName);
                    for(int i=0;i<10000;i++){
                        cancellation.ThrowIfCancellationRequested();var target=Path.Combine(pin.PathName,i==0?preferredName:stem+" ("+i+")"+extension);
                        int error=Rename(handle,target);if(error==0){published=true;return target;}if(error!=80&&error!=183)throw new Win32Exception(error);
                    }throw new IOException("Too many output conflicts");
                }finally{if(!published)DeleteOnClose(handle);}
            }
        }
    }
}
