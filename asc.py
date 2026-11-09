import sys,json,time,base64,subprocess,urllib.request
def b(x): return base64.urlsafe_b64encode(x).rstrip(b'=')
KID='C3X28S5366'; ISS='ae2251a2-85e6-42f5-9071-4f4be62f3b6e'
def token():
    h=b(json.dumps({'alg':'ES256','kid':KID,'typ':'JWT'}).encode()); p=b(json.dumps({'iss':ISS,'iat':int(time.time()),'exp':int(time.time())+900,'aud':'appstoreconnect-v1'}).encode())
    si=h+b'.'+p
    der=subprocess.run(['openssl','dgst','-sha256','-sign',f'/Users/ilseplacencia/.appstoreconnect/private_keys/AuthKey_{KID}.p8'],input=si,capture_output=True).stdout
    i=2+(der[1]&0x7f if der[1]&0x80 else 0); 
    rl=der[i+1]; r=der[i+2:i+2+rl]; j=i+2+rl; sl=der[j+1]; s=der[j+2:j+2+sl]
    r=r.lstrip(b'\0').rjust(32,b'\0'); s=s.lstrip(b'\0').rjust(32,b'\0')
    return (si+b'.'+b(r+s)).decode()
def api(method,path,body=None):
    req=urllib.request.Request('https://api.appstoreconnect.apple.com'+path,method=method,data=json.dumps(body).encode() if body else None,headers={'Authorization':'Bearer '+token(),'Content-Type':'application/json'})
    try: return json.loads(urllib.request.urlopen(req).read() or b'{}')
    except urllib.error.HTTPError as e: return {'err':e.code,'body':e.read().decode()[:600]}
if __name__=='__main__':
    print(json.dumps(api(sys.argv[1],sys.argv[2],json.loads(sys.argv[3]) if len(sys.argv)>3 else None),indent=1))
