#!/usr/bin/env python3
"""
Tableau 元数据治理平台 - 一键启动脚本
并发启动前端 Next.js 服务和后端 Flask API 服务。

用法:
    python3 dev.py start    # 启动服务
    python3 dev.py stop     # 停止服务
    python3 dev.py restart  # 重启服务
    python3 dev.py          # 默认启动服务
"""
import subprocess
import os
import sys
import time
import signal
import argparse

# PID 文件路径
PID_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.dev')
BACKEND_PID_FILE = os.path.join(PID_DIR, 'backend.pid')
FRONTEND_PID_FILE = os.path.join(PID_DIR, 'frontend.pid')


def check_port_availability():
    """检查端口是否可用，如果被占用则提示用户"""
    ports = [8101, 3100]
    port_names = {8101: "后端 Flask", 3100: "前端 Next.js"}
    occupied_ports = []
    
    # 清理 Next.js 锁文件（安全操作）
    lock_file = os.path.join(os.path.dirname(__file__), "frontend/.next/dev/lock")
    if os.path.exists(lock_file):
        try:
            os.remove(lock_file)
            print("🧹 已清理 Next.js 锁文件")
        except:
            pass
    
    # 检测端口占用情况
    for port in ports:
        try:
            result = subprocess.run(
                f"lsof -ti :{port}",
                shell=True,
                capture_output=True,
                text=True
            )
            pids = result.stdout.strip().split('\n')
            pids = [pid for pid in pids if pid]
            
            if pids:
                # 获取进程详细信息
                proc_info = subprocess.run(
                    f"lsof -i :{port} | tail -n +2",
                    shell=True,
                    capture_output=True,
                    text=True
                )
                occupied_ports.append({
                    'port': port,
                    'name': port_names[port],
                    'pids': pids,
                    'info': proc_info.stdout.strip()
                })
        except Exception as e:
            print(f"⚠️ 检查端口 {port} 时出错: {e}")
    
    # 如果有端口被占用，提示用户
    if occupied_ports:
        print("\n" + "=" * 60)
        print("⚠️  端口占用警告")
        print("=" * 60)
        for item in occupied_ports:
            print(f"\n端口 {item['port']} ({item['name']}) 已被占用:")
            print(f"进程 ID: {', '.join(item['pids'])}")
            if item['info']:
                print(f"详细信息:\n{item['info']}")
        
        print("\n" + "=" * 60)
        print("💡 建议操作:")
        print("   1. 手动终止占用进程: kill -9 <PID>")
        print("   2. 或者等待进程自然结束后重新运行")
        print("   3. 如果是系统服务，请考虑更换端口配置")
        print("=" * 60)
        
        # 询问用户是否继续
        try:
            response = input("\n是否仍要尝试启动服务？(y/N): ").strip().lower()
            if response != 'y':
                print("\n❌ 已取消启动。")
                sys.exit(0)
            print("\n⚠️ 继续启动可能会失败，请注意观察错误信息...\n")
        except KeyboardInterrupt:
            print("\n\n❌ 已取消启动。")
            sys.exit(0)
    else:
        print("✓ 端口 8101 和 3100 均可用")

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

def save_pid(pid, pid_file):
    """保存进程 PID 到文件"""
    os.makedirs(PID_DIR, exist_ok=True)
    with open(pid_file, 'w') as f:
        f.write(str(pid))

def read_pid(pid_file):
    """从文件读取 PID"""
    try:
        with open(pid_file, 'r') as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return None

def is_process_running(pid):
    """检查进程是否在运行"""
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def stop_services():
    """停止所有服务"""
    print("=" * 50)
    print("🛑 正在停止服务...")
    print("=" * 50)
    
    stopped_any = False
    ports_to_check = []
    
    # 1. 先尝试通过 PID 文件停止
    backend_pid = read_pid(BACKEND_PID_FILE)
    if backend_pid and is_process_running(backend_pid):
        try:
            if os.name != 'nt':
                os.killpg(os.getpgid(backend_pid), signal.SIGTERM)
            else:
                os.kill(backend_pid, signal.SIGTERM)
            print(f"✓ 已停止后端服务 (PID: {backend_pid})")
            stopped_any = True
        except Exception as e:
            print(f"⚠️ 停止后端服务失败: {e}")
            ports_to_check.append(8101)
        try:
            os.remove(BACKEND_PID_FILE)
        except:
            pass
    else:
        ports_to_check.append(8101)
    
    frontend_pid = read_pid(FRONTEND_PID_FILE)
    if frontend_pid and is_process_running(frontend_pid):
        try:
            if os.name != 'nt':
                os.killpg(os.getpgid(frontend_pid), signal.SIGTERM)
            else:
                os.kill(frontend_pid, signal.SIGTERM)
            print(f"✓ 已停止前端服务 (PID: {frontend_pid})")
            stopped_any = True
        except Exception as e:
            print(f"⚠️ 停止前端服务失败: {e}")
            ports_to_check.append(3100)
        try:
            os.remove(FRONTEND_PID_FILE)
        except:
            pass
    else:
        ports_to_check.append(3100)
    
    # 2. 检查端口是否仍被占用
    port_names = {8101: "后端 Flask", 3100: "前端 Next.js"}
    occupied_ports = []
    
    for port in ports_to_check:
        try:
            result = subprocess.run(
                f"lsof -ti :{port}",
                shell=True,
                capture_output=True,
                text=True
            )
            pids = result.stdout.strip().split('\n')
            pids = [pid for pid in pids if pid]
            
            if pids:
                occupied_ports.append({
                    'port': port,
                    'name': port_names[port],
                    'pids': pids
                })
        except Exception:
            pass
    
    # 3. 如果有端口仍被占用，询问是否强制终止
    if occupied_ports:
        print(f"\n⚠️  发现 {len(occupied_ports)} 个端口仍被占用:")
        for item in occupied_ports:
            print(f"   - 端口 {item['port']} ({item['name']}): PID {', '.join(item['pids'])}")
        
        try:
            response = input("\n是否强制终止这些进程？(y/N): ").strip().lower()
            if response == 'y':
                for item in occupied_ports:
                    for pid in item['pids']:
                        try:
                            os.kill(int(pid), signal.SIGKILL)
                            print(f"✓ 已强制终止进程 {pid} (端口 {item['port']})")
                            stopped_any = True
                        except Exception as e:
                            print(f"⚠️ 终止进程 {pid} 失败: {e}")
        except KeyboardInterrupt:
            print("\n\n已取消强制终止")
    
    if not stopped_any:
        print("ℹ️  没有运行中的服务")
    else:
        time.sleep(1)
        print("✅ 服务已停止")
    
    print("=" * 50)

def start_services():
    """启动所有服务"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    
    # 先检查端口可用性
    print("=" * 50)
    print("🔍 检查端口可用性...")
    print("=" * 50)
    
    # 检查端口占用情况
    ports = [8101, 3100]
    port_names = {8101: "后端 Flask", 3100: "前端 Next.js"}
    has_occupied = False
    
    for port in ports:
        try:
            result = subprocess.run(
                f"lsof -ti :{port}",
                shell=True,
                capture_output=True,
                text=True
            )
            pids = result.stdout.strip().split('\n')
            pids = [pid for pid in pids if pid]
            
            if pids:
                has_occupied = True
                break
        except Exception:
            pass
    
    # 如果有端口被占用，自动清理
    if has_occupied:
        print("⚠️  检测到端口被占用，正在自动清理...")
        print()
        
        # 静默停止服务（不需要用户交互）
        stopped_any = False
        
        # 尝试通过 PID 文件停止
        for pid_file in [BACKEND_PID_FILE, FRONTEND_PID_FILE]:
            pid = read_pid(pid_file)
            if pid and is_process_running(pid):
                try:
                    if os.name != 'nt':
                        os.killpg(os.getpgid(pid), signal.SIGTERM)
                    else:
                        os.kill(pid, signal.SIGTERM)
                    stopped_any = True
                except Exception:
                    pass
                try:
                    os.remove(pid_file)
                except:
                    pass
        
        # 强制清理占用端口的进程
        for port in ports:
            try:
                result = subprocess.run(
                    f"lsof -ti :{port}",
                    shell=True,
                    capture_output=True,
                    text=True
                )
                pids = result.stdout.strip().split('\n')
                pids = [pid for pid in pids if pid]
                
                for pid in pids:
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                        print(f"✓ 已终止占用端口 {port} 的进程 {pid}")
                        stopped_any = True
                    except Exception:
                        pass
            except Exception:
                pass
        
        if stopped_any:
            time.sleep(1)
            print("✓ 端口清理完成")
        print()
    else:
        print("✓ 端口 8101 和 3100 均可用")
        print()
    
    processes = []
    
    try:
        # 1. 启动后端 Flask (端口 8101)
        backend_proc = run_command(
            "python3 run_backend.py",
            cwd=root_dir,
            name="后端服务 (Port 8101)"
        )
        processes.append(('backend', backend_proc))
        save_pid(backend_proc.pid, BACKEND_PID_FILE)
        
        # 等待后端启动一会
        time.sleep(2)
        
        # 2. 启动前端 Next.js (端口 3100)
        frontend_proc = run_command(
            "npm run dev",
            cwd=frontend_dir,
            name="前端服务 (Port 3100)"
        )
        processes.append(('frontend', frontend_proc))
        save_pid(frontend_proc.pid, FRONTEND_PID_FILE)
        
        print("\n✨ 系统已全面启动！")
        print("🔗 前端地址: http://localhost:3100 (本机)")
        print("🔗 后端 API: http://localhost:8101/api (本机)")
        # 获取本机内网 IP
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            print(f"🌐 内网访问: http://{local_ip}:3100")
        except:
            pass
        print("\n💡 提示: 使用 'python3 dev.py stop' 可以停止服务")
        print("按 Ctrl+C 停止所有服务...\n")
        
        # 保持主进程运行
        while True:
            time.sleep(1)
            # 检查子进程是否已中断
            for name, p in processes:
                if p.poll() is not None:
                    print(f"\n⚠️ {name} 进程 {p.pid} 已意外停止。")
                    raise KeyboardInterrupt
                    
    except KeyboardInterrupt:
        print("\n\n🛑 正在停止所有服务...")
        for name, p in processes:
            try:
                if os.name != 'nt':
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                else:
                    p.terminate()
            except Exception:
                pass
        
        # 清理 PID 文件
        for pid_file in [BACKEND_PID_FILE, FRONTEND_PID_FILE]:
            try:
                os.remove(pid_file)
            except:
                pass
        
        print("✅ 服务已关闭。再见！")

def main():
    """主函数 - 处理命令行参数"""
    parser = argparse.ArgumentParser(
        description='Tableau 元数据治理平台 - 开发服务管理',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python3 dev.py start    # 启动服务
  python3 dev.py stop     # 停止服务
  python3 dev.py restart  # 重启服务
        '''
    )
    parser.add_argument(
        'action',
        nargs='?',
        default='start',
        choices=['start', 'stop', 'restart'],
        help='操作: start (启动), stop (停止), restart (重启)'
    )
    
    args = parser.parse_args()
    
    if args.action == 'stop':
        stop_services()
    elif args.action == 'restart':
        stop_services()
        print()
        start_services()
    else:  # start
        start_services()

if __name__ == "__main__":
    main()
