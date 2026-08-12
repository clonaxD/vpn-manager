from flask import Flask, jsonify, request, Response
import os, requests

app=Flask(__name__)
WGEASY_URL="http://127.0.0.1:51821"
WGEASY_PASSWORD=os.environ.get("WGEASY_PASSWORD")
SUPABASE_URL=os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY=os.environ.get("SUPABASE_ANON_KEY")
wg=requests.Session()

def authenticated():
    if request.method=="OPTIONS" or request.path=="/health" or request.path.startswith("/internal/"): return True
    h=request.headers.get("Authorization","")
    if not h.startswith("Bearer "): return False
    token=h[7:].strip()
    if not token or not SUPABASE_URL or not SUPABASE_ANON_KEY: return False
    try:
        r=requests.get(f"{SUPABASE_URL}/auth/v1/user",headers={"Authorization":f"Bearer {token}","apikey":SUPABASE_ANON_KEY},timeout=10)
        return r.status_code==200
    except Exception:return False

@app.before_request
def guard():
    if not authenticated(): return jsonify({"ok":False,"error":"Unauthorized"}),401

@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"]="https://clonaxd.github.io"
    r.headers["Access-Control-Allow-Headers"]="Authorization, Content-Type"
    r.headers["Access-Control-Allow-Methods"]="GET, POST, PUT, OPTIONS"
    return r

@app.route("/<path:p>",methods=["OPTIONS"])
def options(p): return ("",204)

def login():
    if not WGEASY_PASSWORD: raise RuntimeError("WGEASY_PASSWORD is not set")
    r=wg.post(f"{WGEASY_URL}/api/session",json={"password":WGEASY_PASSWORD},timeout=10);r.raise_for_status()
    if not r.json().get("success"): raise RuntimeError("wg-easy login failed")

def req(method,path,**kw):
    r=wg.request(method,f"{WGEASY_URL}{path}",timeout=15,**kw)
    if r.status_code in (401,403,500):
        login();r=wg.request(method,f"{WGEASY_URL}{path}",timeout=15,**kw)
    r.raise_for_status();return r

def clients(): return req("GET","/api/wireguard/client").json()
def safe(c): return {"id":c.get("id"),"name":c.get("name"),"address":c.get("address"),"enabled":c.get("enabled"),"latestHandshakeAt":c.get("latestHandshakeAt"),"transferRx":c.get("transferRx"),"transferTx":c.get("transferTx")}

@app.get("/health")
def health(): return jsonify({"ok":True,"service":"VPN MANAGER k1t0 backend","version":"5"})

@app.get("/api/wg/clients")
def list_clients():
    try:
        x=clients();return jsonify({"ok":True,"count":len(x),"clients":[safe(c) for c in x]})
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500

@app.post("/api/wg/client")
def create():
    try:
        d=request.get_json(silent=True) or {};name=str(d.get("name","")).strip()
        if not name:return jsonify({"ok":False,"error":"Client name is required"}),400
        before={c.get("id") for c in clients()}
        req("POST","/api/wireguard/client",json={"name":name})
        after=clients();c=next((x for x in after if x.get("id") not in before),None)
        return jsonify({"ok":True,"client":safe(c) if c else None})
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500

@app.post("/api/wg/client/<cid>/enable")
def enable(cid):
    try:req("POST",f"/api/wireguard/client/{cid}/enable");return jsonify({"ok":True})
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500

@app.post("/api/wg/client/<cid>/disable")
def disable(cid):
    try:req("POST",f"/api/wireguard/client/{cid}/disable");return jsonify({"ok":True})
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500


@app.post("/internal/wg/<cid>/disable")
def internal_disable(cid):
    if request.headers.get("X-Sync-Token") != os.environ.get("SYNC_ADMIN_TOKEN"):
        return jsonify({"ok":False,"error":"Unauthorized"}),401
    try:req("POST",f"/api/wireguard/client/{cid}/disable");return jsonify({"ok":True})
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500

@app.get("/api/wg/client/<cid>/qr")
def qr(cid):
    try:
        r=req("GET",f"/api/wireguard/client/{cid}/qrcode.svg")
        return Response(r.content,status=200,content_type="image/svg+xml")
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500

@app.get("/api/wg/client/<cid>/config")
def config(cid):
    try:
        r=req("GET",f"/api/wireguard/client/{cid}/configuration")
        return Response(r.content,status=200,content_type="text/plain; charset=utf-8")
    except Exception as e:return jsonify({"ok":False,"error":str(e)}),500
