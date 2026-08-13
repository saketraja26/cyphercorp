import json
import urllib.request


def main():
    login_url = "http://127.0.0.1:8000/auth/login"
    creds = json.dumps({"email": "saket@test.com", "password": "TestPassword123!"}).encode()
    req = urllib.request.Request(login_url, data=creds, headers={"Content-Type": "application/json"})
    token = None
    try:
        resp = urllib.request.urlopen(req)
        body = json.loads(resp.read())
        token = body.get("access_token")
        print("LOGIN STATUS", resp.status)
        print("TOKEN:", token[:20] + "..." if token else "NO TOKEN")
    except Exception as e:
        print("LOGIN ERROR", e)
        try:
            import urllib.error
            if isinstance(e, urllib.error.HTTPError):
                print(e.read().decode())
        except Exception:
            pass
        raise

    # call protected
    req2 = urllib.request.Request("http://127.0.0.1:8000/datasets/")
    req2.add_header("Authorization", f"Bearer {token}")
    try:
        r2 = urllib.request.urlopen(req2)
        print("DATASETS STATUS", r2.status)
        print(r2.read().decode())
    except Exception as e:
        print("DATASETS ERROR", e)
        try:
            import urllib.error
            if isinstance(e, urllib.error.HTTPError):
                print(e.read().decode())
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()

