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
    
    processes = []
    
    try:
        # 1. 启动后端 Flask (端口 8001)
        backend_proc = run_command(
            "python3 run_backend.py",
            cwd=root_dir,
            name="后端服务 (Port 8001)"
        )
        processes.append(backend_proc)
        
        # 等待后端启动一会
        time.sleep(2)
        
        # 2. 启动前端 Next.js (端口 3000)
        frontend_proc = run_command(
            "npm run dev",
            cwd=frontend_dir,
            name="前端服务 (Port 3000)"
        )
        processes.append(frontend_proc)
        
        print("\n✨ 系统已全面启动！")
        print("🔗 前端地址: http://localhost:3000")
        print("🔗 后端 API: http://localhost:8001/api")
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
