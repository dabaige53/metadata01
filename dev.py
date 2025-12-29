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
LOG_DIR = os.path.join(PID_DIR, 'logs')

# 是否强制清理占用端口的进程（默认开启）
FORCE_KILL_PORTS = os.environ.get('FORCE_KILL_PORTS', '1') == '1'


def get_ports():
    backend_port = int(os.environ.get('BACKEND_PORT', os.environ.get('PORT', 8201)))
    frontend_port = int(os.environ.get('FRONTEND_PORT', 3200))
    return backend_port, frontend_port


def check_port_availability():
    """检查端口是否可用，如果被占用则提示用户"""
    backend_port, frontend_port = get_ports()
    ports = [backend_port, frontend_port]
    port_names = {backend_port: "后端 Flask", frontend_port: "前端 Next.js"}
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
        print("   2. 或者运行: python3 dev.py stop")
        print("=" * 60)
        
        # 移除交互式询问，改为直接警告
        print("\n⚠️  检测到端口占用，继续启动可能会失败。请清理后再试。\n")
        # 为保证自动化流程，这里不退出，但在 start_services 中会再次处理占用逻辑
    else:
        print(f"✓ 端口 {', '.join(map(str, ports))} 均可用")

def run_command(command, cwd=None, name="", log_file=None, env=None):
    """运行子进程并重定向输出"""
    os.makedirs(LOG_DIR, exist_ok=True)
    
    stdout = sys.stdout
    stderr = sys.stderr
    
    if log_file:
        stdout = open(log_file, 'a')
        stderr = stdout
        print(f"🚀 正在启动 {name} (日志: {log_file})...")
    else:
        print(f"🚀 正在启动 {name}...")
        
    return subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        stdout=stdout,
        stderr=stderr,
        env=env,
        start_new_session=True  # 现代推荐方式：在独立会话中运行子进程
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

def get_process_info(pid):
    """获取进程名称和命令行"""
    try:
        # 使用 ps 命令获取进程信息
        result = subprocess.run(
            f"ps -p {pid} -o comm=,args=",
            shell=True,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(None, 1)
            name = parts[0] if parts else "unknown"
            args = parts[1] if len(parts) > 1 else ""
            return name, args
    except Exception:
        pass
    return "unknown", ""

def is_safe_to_kill(pid):
    """判断进程是否可以安全地自动终止
    
    只有当进程明确属于本项目时才返回 True，避免误杀 IDE 服务
    """
    if FORCE_KILL_PORTS:
        return True
    name, args = get_process_info(pid)
    name = name.lower()
    args = args.lower()
    
    # 获取项目根目录路径（用于匹配）
    project_root = os.path.dirname(os.path.abspath(__file__)).lower()
    
    # 本项目特定的关键词列表
    project_keywords = [
        'run_backend.py', 
        'dev.py', 
        'deploy.py',
        'next dev', 
        'next start',
        'next-server',          # 显式包含 Next.js 运行进程
        'next-router-worker',
        'metadata分析',         # 项目目录名
        'metadata-analysis'
    ]
    
    # 强制保护列表：绝不杀死包含这些关键词的进程（IDE 核心进程）
    protection_keywords = [
        'antigravity',
        'cursor',
        'vscode',
        'python3 -m ccc',
        'pyright',
        'droid',                  # Claude Code 终端
        'claude',
        'language_server',        # Antigravity 语言服务器
        'codex'                   # OpenAI Codex 相关
    ]
    
    if any(pk in args or pk in name for pk in protection_keywords):
        return False
        
    # 只有命令行参数包含本项目路径或特定关键词时才允许杀死
    if project_root in args:
        return True
    
    if any(kw in args for kw in project_keywords):
        return True
        
    return False

def get_child_pids(pid):
    """递归获取进程及其所有子进程的 PID 列表（子进程优先，父进程在最后）"""
    pids = []
    try:
        # 使用 pgrep 获取子进程
        result = subprocess.run(
            f"pgrep -P {pid}",
            shell=True,
            capture_output=True,
            text=True
        )
        child_pids = result.stdout.strip().split('\n')
        child_pids = [int(p) for p in child_pids if p]
        
        # 递归获取子进程的子进程
        for child_pid in child_pids:
            pids.extend(get_child_pids(child_pid))
        
        pids.extend(child_pids)
    except Exception:
        pass
    
    return pids

def kill_process_gracefully(pid, name=""):
    """优雅地终止进程及其所有子进程
    
    重要：不使用 killpg，避免误杀同一终端中的其他进程（如 Claude Code）
    """
    try:
        # 1. 获取所有子进程（子进程优先终止）
        child_pids = get_child_pids(pid)
        all_pids = child_pids + [pid]  # 子进程在前，父进程在后
        
        # 2. 向所有进程发送 SIGTERM
        for p in all_pids:
            try:
                os.kill(p, signal.SIGTERM)
            except ProcessLookupError:
                pass  # 进程可能已经退出
            except Exception:
                pass
        
        # 3. 等待主进程退出
        for _ in range(10):
            if not is_process_running(pid):
                return True
            time.sleep(0.2)
            
        # 4. 如果还在，强制终止所有相关进程
        print(f"   ⚠️  进程 {pid} 未能优雅退出，正在强制终止...")
        for p in all_pids:
            try:
                if is_process_running(p):
                    os.kill(p, signal.SIGKILL)
            except Exception:
                pass
        
        return True
    except Exception as e:
        print(f"   ❌ 终止进程 {pid} 失败: {e}")
        return False

def stop_services():
    """停止所有服务（通过 PID 文件和端口主动检查）"""
    print("=" * 50)
    print("🛑 正在停止服务...")
    print("=" * 50)
    
    stopped_any = False
    backend_port, frontend_port = get_ports()
    ports = [backend_port, frontend_port]
    port_names = {backend_port: "后端 Flask", frontend_port: "前端 Next.js"}
    
    # 步骤 1: 通过 PID 文件停止进程
    for pid_file, service_name in [(BACKEND_PID_FILE, "后端"), (FRONTEND_PID_FILE, "前端")]:
        pid = read_pid(pid_file)
        if pid:
            if is_process_running(pid):
                if not is_safe_to_kill(pid):
                    print(f"⚠️  警告: PID {pid} ({service_name}) 对应的进程似乎不是本项目服务。")
                else:
                    if kill_process_gracefully(pid, service_name):
                        print(f"✓ 已通过 PID 文件停止{service_name}服务 (PID: {pid})")
                        stopped_any = True
            
            # 清理 PID 文件
            try:
                os.remove(pid_file)
            except:
                pass
    
    # 步骤 2: 主动检查端口并清理残留
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
            
            for pid_str in pids:
                pid = int(pid_str)
                if is_safe_to_kill(pid):
                    print(f"🔍 发现端口 {port} ({port_names[port]}) 仍有残留进程 {pid}，正在清理...")
                    if kill_process_gracefully(pid, port_names[port]):
                        stopped_any = True
                else:
                    print(f"ℹ️  端口 {port} 被非本项目进程 {pid} 占用，跳过。")
        except:
            pass
    
    if not stopped_any:
        print("ℹ️  没有发现运行中的项目服务")
    else:
        time.sleep(0.5)
        print("✅ 服务清理完成")
    
    print("=" * 50)

def start_services(is_daemon=False):
    """启动所有服务"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    backend_port, frontend_port = get_ports()
    
    # 先停止之前由本脚本启动的服务（通过 PID 文件）
    print("=" * 50)
    print("🔍 检查并清理旧进程...")
    print("=" * 50)
    
    stopped_any = False
    
    # 只停止 PID 文件记录的进程
    for pid_file, service_name in [(BACKEND_PID_FILE, "后端"), (FRONTEND_PID_FILE, "前端")]:
        pid = read_pid(pid_file)
        if pid:
            if is_process_running(pid):
                if not is_safe_to_kill(pid):
                    print(f"⚠️  PID {pid} 对应的旧{service_name}记录似乎不是本项目服务，跳过终止。")
                else:
                    try:
                        kill_process_gracefully(pid, service_name)
                        print(f"✓ 已停止旧的{service_name}服务 (PID: {pid})")
                        stopped_any = True
                    except Exception as e:
                        print(f"⚠️  停止{service_name}服务时出错: {e}")
            
            # 清理 PID 文件
            try:
                os.remove(pid_file)
            except:
                pass
    
    if stopped_any:
        time.sleep(0.5)
        print("✓ 旧进程已清理")
    
    # 检查端口是否仍被占用
    ports = [backend_port, frontend_port]
    port_names = {backend_port: "后端 Flask", frontend_port: "前端 Next.js"}
    occupied_ports = []
    
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
                occupied_ports.append({'port': port, 'name': port_names[port], 'pids': pids})
        except Exception:
            pass
    
    # 如果端口仍被占用，直接报错退出
    if occupied_ports:
        print("\n" + "⚠️ " * 20)
        print("警告：以下端口仍被其他进程占用")
        print("⚠️ " * 20)
        for item in occupied_ports:
            print(f"\n端口 {item['port']} ({item['name']}) 已被占用:")
            for pid in item['pids']:
                p_name, p_args = get_process_info(int(pid))
                print(f"  - PID {pid}: {p_name}")
                if p_args:
                    print(f"    命令: {p_args[:80]}...")
        print("\n💡 建议操作:")
        print("   1. 手动终止占用进程: kill -9 <PID>")
        print("   2. 或者使用: python3 dev.py stop")
        print("⚠️ " * 20 + "\n")
        
        print("❌ 端口被占用，启动已中止。请清理端口后重试。")
        sys.exit(1)
    else:
        print(f"✓ 端口 {', '.join(map(str, ports))} 均可用")
    
    print()
    
    # 3. 启动后台进程
    os.makedirs(LOG_DIR, exist_ok=True)
    
    # 根据模式决定日志去向
    backend_log = None
    frontend_log = None
    
    if is_daemon:
        backend_log = os.path.join(LOG_DIR, 'backend.log')
        frontend_log = os.path.join(LOG_DIR, 'frontend.log')
    
    try:
        # 1. 启动后端 Flask (端口 8201)
        backend_proc = run_command(
            "python3 run_backend.py",
            cwd=root_dir,
            name=f"后端服务 (Port {backend_port})",
            log_file=backend_log,
            env={**os.environ, "PORT": str(backend_port)}
        )
        save_pid(backend_proc.pid, BACKEND_PID_FILE)
        
        # 等待后端启动一会
        time.sleep(2)
        
        # 2. 启动前端 Next.js (端口 3200)
        frontend_proc = run_command(
            "npm run dev",
            cwd=frontend_dir,
            name=f"前端服务 (Port {frontend_port})",
            log_file=frontend_log,
            env={**os.environ, "PORT": str(frontend_port)}
        )
        save_pid(frontend_proc.pid, FRONTEND_PID_FILE)
        
        print("\n✨ 系统已全面启动！")
        print(f"🔗 前端地址: http://localhost:{frontend_port} (本机)")
        print(f"🔗 后端 API: http://localhost:{backend_port}/api (本机)")
        
        # 获取本机内网 IP
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            print(f"🌐 内网访问: http://{local_ip}:{frontend_port}")
        except:
            pass

        if is_daemon:
            print("\n💡 服务已在后台成功启动！")
            print("💡 提示: 使用 'python3 dev.py stop' 可以停止服务")
            print(f"💡 日志已存放在: {LOG_DIR}")
            print("✅ 脚本执行完成，已返回。再见！\n")
        else:
            print("\n💡 服务已启动！正在监听日志输出 (按 Ctrl+C 停止所有服务)...")
            print("=" * 60 + "\n")
            
            try:
                # 循环监控子进程状态
                while True:
                    time.sleep(1)
                    b_poll = backend_proc.poll()
                    f_poll = frontend_proc.poll()
                    
                    if b_poll is not None:
                        print(f"\n❌ 后端服务已退出 (Exit Code: {b_poll})")
                        break
                    
                    if f_poll is not None:
                        print(f"\n❌ 前端服务已退出 (Exit Code: {f_poll})")
                        break
                        
            except KeyboardInterrupt:
                print("\n\n🛑 接收到停止信号 (Ctrl+C)，正在停止所有服务...")
            finally:
                stop_services()
                sys.exit(0)
        
    except Exception as e:
        print(f"\n❌ 启动过程中出错: {e}")
        stop_services()
        sys.exit(1)

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
    
    parser.add_argument(
        '-d', '--daemon',
        action='store_true',
        help='后台模式运行 (不占用终端，日志输出到文件)'
    )
    
    args = parser.parse_args()
    
    if args.action == 'stop':
        stop_services()
    elif args.action == 'restart':
        stop_services()
        print()
        start_services(is_daemon=args.daemon)
    else:  # start
        start_services(is_daemon=args.daemon)

if __name__ == "__main__":
    main()
