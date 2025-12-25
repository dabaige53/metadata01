#!/usr/bin/env python3
"""
Tableau 元数据治理平台 - 生产部署脚本
使用预编译的生产构建，性能比开发模式提升 10-50 倍。

用法:
    python3 deploy.py           # 构建并启动
    python3 deploy.py --skip-build  # 跳过构建，直接启动
    python3 deploy.py stop      # 停止服务
"""
import subprocess
import os
import sys
import time
import signal
import argparse
import socket

# 目录配置
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
PID_DIR = os.path.join(ROOT_DIR, '.dev')
BACKEND_PID_FILE = os.path.join(PID_DIR, 'backend.pid')
FRONTEND_PID_FILE = os.path.join(PID_DIR, 'frontend.pid')


def get_local_ip():
    """获取本机内网 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return None


def save_pid(pid, pid_file):
    """保存进程 PID"""
    os.makedirs(PID_DIR, exist_ok=True)
    with open(pid_file, 'w') as f:
        f.write(str(pid))


def read_pid(pid_file):
    """读取进程 PID"""
    try:
        with open(pid_file, 'r') as f:
            return int(f.read().strip())
    except:
        return None


def is_process_running(pid):
    """检查进程是否运行"""
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def stop_services():
    """停止所有服务"""
    print("🛑 正在停止服务...")
    
    stopped = False
    for pid_file, name in [(BACKEND_PID_FILE, "后端"), (FRONTEND_PID_FILE, "前端")]:
        pid = read_pid(pid_file)
        if pid and is_process_running(pid):
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
                print(f"✓ 已停止{name}服务 (PID: {pid})")
                stopped = True
            except:
                pass
            try:
                os.remove(pid_file)
            except:
                pass
    
    # 强制清理端口
    for port in [8101, 3100]:
        try:
            result = subprocess.run(f"lsof -ti :{port}", shell=True, capture_output=True, text=True)
            pids = [p for p in result.stdout.strip().split('\n') if p]
            for pid in pids:
                os.kill(int(pid), signal.SIGKILL)
                stopped = True
        except:
            pass
    
    if stopped:
        print("✅ 服务已停止")
    else:
        print("ℹ️  没有运行中的服务")


def build_frontend():
    """构建前端生产版本"""
    print("\n📦 正在构建前端生产版本...")
    print("   这可能需要 1-2 分钟，请稍候...\n")
    
    result = subprocess.run(
        "npm run build",
        shell=True,
        cwd=FRONTEND_DIR
    )
    
    if result.returncode != 0:
        print("❌ 前端构建失败！")
        sys.exit(1)
    
    print("\n✅ 前端构建完成！")


def start_services():
    """启动生产服务"""
    processes = []
    
    try:
        # 1. 启动后端
        print("\n🚀 正在启动后端服务...")
        backend_proc = subprocess.Popen(
            "python3 run_backend.py",
            shell=True,
            cwd=ROOT_DIR,
            stdout=sys.stdout,
            stderr=sys.stderr,
            preexec_fn=os.setsid
        )
        processes.append(('backend', backend_proc))
        save_pid(backend_proc.pid, BACKEND_PID_FILE)
        time.sleep(2)
        
        # 2. 启动前端（生产模式）
        print("🚀 正在启动前端服务（生产模式）...")
        frontend_proc = subprocess.Popen(
            "npm run start",
            shell=True,
            cwd=FRONTEND_DIR,
            stdout=sys.stdout,
            stderr=sys.stderr,
            preexec_fn=os.setsid
        )
        processes.append(('frontend', frontend_proc))
        save_pid(frontend_proc.pid, FRONTEND_PID_FILE)
        
        # 显示访问地址
        print("\n" + "=" * 50)
        
        print("✨ 生产环境已启动！")
        print("=" * 50)
        print("🔗 本机访问: http://localhost:3100")
        
        local_ip = get_local_ip()
        if local_ip:
            print(f"🌐 内网访问: http://{local_ip}:3100")
        
        print("\n💡 提示: 使用 'python3 deploy.py stop' 停止服务")
        print("按 Ctrl+C 停止所有服务...\n")
        
        # 保持运行
        while True:
            time.sleep(1)
            for name, p in processes:
                if p.poll() is not None:
                    print(f"\n⚠️ {name} 进程意外停止")
                    raise KeyboardInterrupt
                    
    except KeyboardInterrupt:
        print("\n\n🛑 正在停止服务...")
        for name, p in processes:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except:
                pass
        for f in [BACKEND_PID_FILE, FRONTEND_PID_FILE]:
            try:
                os.remove(f)
            except:
                pass
        print("✅ 服务已关闭")


def main():
    parser = argparse.ArgumentParser(description='生产环境部署脚本')
    parser.add_argument('action', nargs='?', default='start', choices=['start', 'stop'])
    parser.add_argument('--skip-build', action='store_true', help='跳过前端构建')
    args = parser.parse_args()
    
    if args.action == 'stop':
        stop_services()
        return
    
    # 先停止已有服务
    stop_services()
    
    # 构建前端
    if not args.skip_build:
        build_frontend()
    
    # 启动服务
    start_services()


if __name__ == "__main__":
    main()
