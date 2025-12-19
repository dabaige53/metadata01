#!/usr/bin/env python3
"""
Tableau 元数据治理平台 - 一键启动脚本
并发启动前端 Next.js 服务和后端 Flask API 服务。
"""
import subprocess
import os
import sys
import time
import signal


def kill_existing_processes():
    """关闭已占用端口 8001 和 3000 的进程"""
    ports = [8101, 3100]
    
    # 额外清理 Next.js 锁文件
    lock_file = os.path.join(os.path.dirname(__file__), "frontend/.next/dev/lock")
    if os.path.exists(lock_file):
        try:
            os.remove(lock_file)
            print("🧹 已清理 Next.js 锁文件")
        except:
            pass
            
    killed_any = False
    
    for port in ports:
        try:
            # 使用 lsof 查找占用端口的进程
            result = subprocess.run(
                f"lsof -ti :{port}",
                shell=True,
                capture_output=True,
                text=True
            )
            pids = result.stdout.strip().split('\n')
            pids = [pid for pid in pids if pid]  # 过滤空字符串
            
            if pids:
                print(f"🔍 发现端口 {port} 被占用，正在关闭相关进程...")
                for pid in pids:
                    try:
                        # 尝试 SIGTERM
                        os.kill(int(pid), signal.SIGTERM)
                        time.sleep(0.5)
                        
                        # 检查是否还在运行，如果是则 SIGKILL
                        try:
                            os.kill(int(pid), 0)
                            os.kill(int(pid), signal.SIGKILL)
                            print(f"   ✓ 已强制终止进程 {pid}")
                        except OSError:
                            print(f"   ✓ 已终止进程 {pid}")
                            
                        killed_any = True
                    except (ProcessLookupError, ValueError, OSError):
                        pass
        except Exception as e:
            print(f"⚠️ 检查端口 {port} 时出错: {e}")
    
    if killed_any:
        print("⏳ 等待进程完全退出...")
        time.sleep(1)
    else:
        print("✓ 端口 8101 和 3100 均未被占用")

def run_command(command, cwd=None, name=""):
    """运行子进程"""
    print(f"🚀 正在启动 {name}...")
    return subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        stdout=sys.stdout,
        stderr=sys.stderr,
        preexec_fn=os.setsid if os.name != 'nt' else None
    )

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    
    # 先关闭已有进程
    print("=" * 50)
    print("🧹 检查并清理现有进程...")
    print("=" * 50)
    kill_existing_processes()
    print()
    
    processes = []
    
    try:
        # 1. 启动后端 Flask (端口 8001)
        backend_proc = run_command(
            "python3 run_backend.py",
            cwd=root_dir,
            name="后端服务 (Port 8101)"
        )
        processes.append(backend_proc)
        
        # 等待后端启动一会
        time.sleep(2)
        
        # 2. 启动前端 Next.js (端口 3100)
        frontend_proc = run_command(
            "npm run dev",
            cwd=frontend_dir,
            name="前端服务 (Port 3100)"
        )
        processes.append(frontend_proc)
        
        print("\n✨ 系统已全面启动！")
        print("🔗 前端地址: http://localhost:3100")
        print("🔗 后端 API: http://localhost:8101/api")
        print("\n按 Ctrl+C 停止所有服务...\n")
        
        # 保持主进程运行
        while True:
            time.sleep(1)
            # 检查子进程是否已中断
            for p in processes:
                if p.poll() is not None:
                    print(f"\n⚠️ 进程 {p.pid} 已意外停止。")
                    raise KeyboardInterrupt
                    
    except KeyboardInterrupt:
        print("\n\n🛑 正在停止所有服务...")
        for p in processes:
            try:
                if os.name != 'nt':
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                else:
                    p.terminate()
            except Exception:
                pass
        print("✅ 服务已关闭。再见！")

if __name__ == "__main__":
    main()
