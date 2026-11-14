$ErrorActionPreference = 'Stop'
try {
    $credentialInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($credentialInput.target -notmatch '^E-Pharmacy/[^/]+/demo$' -or $credentialInput.username -ne 'demo@e-pharmacy.example' -or [string]::IsNullOrEmpty($credentialInput.password)) { throw 'Invalid request' }
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
public static class DemoCredentialStore {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential {
        public uint Flags, Type;
        public string TargetName, Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist, AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias, UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool Read(string target, uint type, uint flags, out IntPtr value);
    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool Write(ref Credential value, uint flags);
    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr value);
    public static void Store(string target, string username, string password) {
        string mutexName;
        using (var hash = SHA256.Create()) mutexName = "Local\\EPharmacyDemo_" + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(target))).Replace("-", "");
        using (var mutex = new Mutex(false, mutexName)) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(10000); } catch (AbandonedMutexException) { owned = true; }
                if (!owned) throw new InvalidOperationException("Credential store is busy");
                StoreOnce(target, username, password);
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
    private static void StoreOnce(string target, string username, string password) {
        IntPtr existing;
        if (Read(target, 1, 0, out existing)) { CredFree(existing); throw new InvalidOperationException("Credential exists"); }
        if (Marshal.GetLastWin32Error() != 1168) throw new InvalidOperationException("Credential lookup failed");
        IntPtr blob = Marshal.StringToCoTaskMemUni(password);
        try {
            var value = new Credential { Type = 1, TargetName = target, UserName = username, CredentialBlob = blob, CredentialBlobSize = checked((uint)password.Length * 2), Persist = 2 };
            if (!Write(ref value, 0)) throw new InvalidOperationException("Credential storage failed");
        } finally { Marshal.ZeroFreeCoTaskMemUnicode(blob); }
    }
}
'@
    [DemoCredentialStore]::Store($credentialInput.target, $credentialInput.username, $credentialInput.password)
} catch {
    [Console]::Error.WriteLine('Secure credential storage failed or refused an existing target.')
    exit 1
}
