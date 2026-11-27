"""Send a Python snippet or file to the running dev-loop editor and print its output.

  python source/ue_send.py path/to/script.py [timeout_seconds]
  python source/ue_send.py -c "print(unreal.SystemLibrary.get_engine_version())"
"""
import os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CMD = os.path.join(ROOT, "build", "cmd")


def send(code, timeout=600.0, quiet=False):
    os.makedirs(CMD, exist_ok=True)
    stem = os.path.join(CMD, "c%d_%d" % (int(time.time() * 1000), os.getpid()))
    with open(stem + ".tmp", "w", encoding="utf-8") as f:
        f.write(code)
    os.rename(stem + ".tmp", stem + ".py")
    t0 = time.time()
    while not os.path.exists(stem + ".done"):
        if time.time() - t0 > timeout:
            raise TimeoutError("editor did not answer within %.0f s" % timeout)
        time.sleep(0.25)
    time.sleep(0.05)
    with open(stem + ".out", "r", encoding="utf-8") as f:
        out = f.read()
    os.remove(stem + ".done")
    os.remove(stem + ".out")
    status, _, body = out.partition("\n")
    if not quiet:
        print(body.rstrip())
    return status == "OK", body


if __name__ == "__main__":
    if sys.argv[1] == "-c":
        code, rest = sys.argv[2], sys.argv[3:]
    else:
        p = os.path.abspath(sys.argv[1])
        code = "__file__ = r'%s'\nexec(compile(open(__file__, encoding='utf-8').read(), __file__, 'exec'))" % p
        rest = sys.argv[2:]
    ok, _ = send(code, float(rest[0]) if rest else 600.0)
    sys.exit(0 if ok else 1)
