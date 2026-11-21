# 给正在运行的 Cocos 编辑器发指令（经 yj-bridge 扩展）。
# 用法：python cc.py steps.json   或   python cc.py --js code.js   （后者在场景进程里执行 code.js 的函数体）
import json, os, sys, time, uuid

BRIDGE = r'C:\Users\86193\repos\yuanjie\cocos\battle\extensions\yj-bridge'


def send(steps, timeout=180):
    name = f'{time.time():.3f}-{uuid.uuid4().hex[:6]}.json'
    tmp = os.path.join(BRIDGE, 'cmd', name + '.tmp')
    json.dump({'steps': steps}, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(tmp, os.path.join(BRIDGE, 'cmd', name))
    out = os.path.join(BRIDGE, 'out', name)
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(out):
            time.sleep(0.1)
            return json.load(open(out, encoding='utf-8'))
        time.sleep(0.3)
    raise SystemExit('超时：编辑器没有响应')


if __name__ == '__main__':
    if sys.argv[1] == '--js':
        files = [a for a in sys.argv[2:] if a.endswith('.js')]
        code = chr(10).join(open(f, encoding='utf-8').read() for f in files)
        steps = [{'script': 'run', 'args': [code]}] + [json.loads(a) for a in sys.argv[2:] if not a.endswith('.js')]
    else:
        steps = json.load(open(sys.argv[1], encoding='utf-8'))
    print(json.dumps(send(steps), ensure_ascii=False, indent=1)[:6000])
