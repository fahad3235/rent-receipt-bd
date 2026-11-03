import asyncio, json, subprocess, sys, time, urllib.request
import websockets

import os
CHROME = os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell")
PAGE = "file:///home/hatch/workspace/muse-project-factory/builds/rent-receipt-bd/index.html"
PORT = 9231

async def main():
    proc = subprocess.Popen([CHROME,
        f"--remote-debugging-port={PORT}", "--no-sandbox", "--disable-gpu",
        "--user-data-dir=/tmp/rr-smoke-prof", "--window-size=1280,900", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(50):
            try:
                data = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2))
                ws_url = data["webSocketDebuggerUrl"]; break
            except Exception:
                time.sleep(0.3)
        assert ws_url, "no debugger url"
        async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
            mid = [0]
            async def send(method, params=None):
                mid[0] += 1
                await ws.send(json.dumps({"id": mid[0], "method": method, "params": params or {}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == mid[0]:
                        return msg
            # new tab via Target
            r = await send("Target.createTarget", {"url": PAGE})
            tid = r["result"]["targetId"]
            r = await send("Target.attachToTarget", {"targetId": tid, "flatten": True})
            sid = r["result"]["sessionId"]
            console_errors = []
            async def ev(expr):
                mid[0] += 1
                await ws.send(json.dumps({"id": mid[0], "method": "Runtime.evaluate",
                    "params": {"expression": expr, "returnByValue": True}, "sessionId": sid}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("method") == "Runtime.consoleAPICalled" and msg["params"].get("type") == "error":
                        console_errors.append(msg["params"])
                    if msg.get("method") == "Runtime.exceptionThrown":
                        console_errors.append(msg["params"])
                    if msg.get("id") == mid[0]:
                        res = msg["result"]["result"]
                        if "value" in res: return res["value"]
                        return res
            await asyncio.sleep(1.5)
            mid[0] += 1
            await ws.send(json.dumps({"id": mid[0], "method": "Runtime.enable", "params": {}, "sessionId": sid}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == mid[0]: break
            checks = []
            def ck(name, cond, extra=""):
                checks.append((name, bool(cond)))
                print(("PASS " if cond else "FAIL ") + name + (" | " + str(extra) if extra else ""))
            ck("title", (await ev("document.title")) == "Rent Receipt BD — Monthly Rent Receipts", await ev("document.title"))
            ck("4 tabs", await ev("document.querySelectorAll('.tab-btn').length") == 4)
            ck("dashboard visible", not (await ev("document.getElementById('tab-dashboard').classList.contains('hidden')")))
            # add tenant
            await ev("""(()=>{ document.getElementById('f-name').value='Rahim Uddin';
              document.getElementById('f-property').value='Flat 3B, Mirpur';
              document.getElementById('f-rent').value='12000';
              document.getElementById('f-advance').value='24000';
              document.getElementById('f-phone').value='01712345678';
              document.getElementById('f-start').value='2026-11';
              document.getElementById('tenant-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
              return true; })()""")
            await asyncio.sleep(0.5)
            ck("tenant listed", "Rahim Uddin" in (await ev("document.getElementById('tenant-list').innerText")))
            ck("dashboard collected 0", await ev("document.getElementById('stat-collected').innerText") == "৳0.00")
            # record payment: switch to tenants tab is not needed; form is in tenants panel (hidden but functional)
            await ev("""(()=>{ const sel=document.getElementById('tenant-select');
              document.getElementById('p-month').value='2026-11';
              document.getElementById('p-amount').value='12000';
              document.getElementById('p-method').value='bKash';
              document.getElementById('p-date').value='2026-11-03';
              document.getElementById('payment-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
              return sel.value; })()""")
            await asyncio.sleep(0.5)
            ck("receipt RR-2026-0001", "RR-2026-0001" in (await ev("document.getElementById('receipt-list').innerText")))
            ck("dashboard collected 12000", await ev("document.getElementById('stat-collected').innerText") == "৳12,000.00",
               await ev("document.getElementById('stat-collected').innerText"))
            ck("dashboard outstanding 0", await ev("document.getElementById('stat-outstanding').innerText") == "৳0.00")
            ck("advance held 24000", await ev("document.getElementById('stat-advance').innerText") == "৳24,000.00")
            # partial: second tenant unpaid
            await ev("""(()=>{ document.getElementById('f-name').value='Karim';
              document.getElementById('f-property').value='Flat 1A';
              document.getElementById('f-rent').value='8000';
              document.getElementById('f-advance').value='0';
              document.getElementById('f-start').value='2026-11';
              document.getElementById('tenant-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
              return true; })()""")
            await asyncio.sleep(0.5)
            ck("outstanding 8000 after 2nd tenant", await ev("document.getElementById('stat-outstanding').innerText") == "৳8,000.00",
               await ev("document.getElementById('stat-outstanding').innerText"))
            # validation: empty tenant name shows error
            await ev("""(()=>{ document.getElementById('f-name').value='';
              document.getElementById('f-property').value='X';
              document.getElementById('f-rent').value='1000';
              document.getElementById('f-start').value='2026-11';
              document.getElementById('tenant-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
              return true; })()""")
            await asyncio.sleep(0.3)
            ck("empty-name inline error", not (await ev("document.getElementById('tenant-error').classList.contains('hidden')")))
            # BN toggle renders Bengali digits
            await ev("document.getElementById('lang-bn').click()")
            await asyncio.sleep(0.5)
            bn = await ev("document.getElementById('stat-collected').innerText")
            ck("BN digits render", "১২,০০০" in bn, bn)
            # persistence: reload
            mid[0] += 1
            await ws.send(json.dumps({"id": mid[0], "method": "Page.reload", "params": {}, "sessionId": sid}))
            await asyncio.sleep(1.5)
            ck("persist after reload", "Rahim Uddin" in (await ev("document.getElementById('tenant-list').innerText")))
            ck("0 console/page errors", len(console_errors) == 0, console_errors[:2])
            failed = [c for c in checks if not c[1]]
            print(f"SMOKE {len(checks)-len(failed)}/{len(checks)} passed")
            if failed: sys.exit(1)
    finally:
        proc.terminate()

asyncio.run(main())
