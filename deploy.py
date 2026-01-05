#!/usr/bin/env python3
"""
Tableau 元数据治理平台 - 生产部署脚本
使用预编译的生产构建，性能比开发模式提升 10-50 倍。

用法:
    venv/bin/python deploy.py           # 构建并启动
    venv/bin/python deploy.py --skip-build  # 跳过构建，直接启动
    venv/bin/python deploy.py stop      # 停止服务

访问地址:
    本机: http://localhost:3200
    局域网: http://<内网IP>:3200 (启动时显示)

========================================
性能优化记录 (2026-01-05)
========================================

1. Flask 后端优化:
   - threaded=True: 启用多线程模式，支持并发请求
   - 避免单线程阻塞导致局域网用户访问慢

2. Next.js 前端优化:
   - compress: true - 启用 gzip 压缩
   - optimizePackageImports - ECharts/Mermaid/Lucide 按需加载
   - Cache-Control 长缓存 - 静态资源一年缓存
   - ECharts 延迟加载 - 使用 lazy() + Suspense
   - 渐进式 API 加载 - stats 先加载显示，其他后台加载

3. 首页加载优化:
   - 资产卡片使用 stats API (292B) 快速显示
   - dashboard API (9.5KB) 异步加载治理图表
   - sankey API (3.3KB) 配合 ECharts 懒加载

========================================
局域网访问问题排查
========================================

问题: 局域网用户访问慢或无法加载

排查步骤:

1. 确认使用正确的 IP 地址:
   - ✅ 使用: http://172.29.x.x:3200 (真实局域网 IP)
   - ❌ 不要用: http://198.18.x.x:3200 (VPN/隧道接口，会超时)

   查看正确 IP:
   $ ifconfig | grep "inet " | grep -v 127.0.0.1

2. 检查服务状态:
   $ lsof -i:3200 -i:8201 | grep LISTEN
   应该看到 node (3200) 和 Python (8201) 两个进程

3. 测试 API 连通性:
   $ curl -w "时间: %{time_total}s" -o /dev/null -s http://localhost:3200/api/stats
   $ curl -w "时间: %{time_total}s" -o /dev/null -s http://<局域网IP>:3200/api/stats
   正常应该 < 100ms

4. 检查防火墙:
   $ /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   如果开启，需要允许 node 和 Python 的入站连接

5. 查看后端日志:
   $ tail -f /tmp/backend.log
   确认是否收到局域网用户的请求

6. 首次加载慢是正常的:
   - 首次需要下载 ~650KB (压缩后) 的 JS 资源
   - 二次访问会使用缓存，秒开

常见问题:

Q: 侧边栏显示了，但卡片/数据不显示
A: JS 资源加载完成，但 API 请求未返回。检查网络延迟或 API 错误。

Q: 完全白屏很久
A: JS 资源加载慢。检查网络带宽，或让用户刷新重试（缓存后会变快）。

Q: 血缘图不显示
A: ECharts 是延迟加载的，等待 "加载血缘图..." 提示消失即可。
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

# 虚拟环境 Python 路径
VENV_PYTHON = os.path.join(ROOT_DIR, "venv", "bin", "python")


def get_local_ip():
    """获取本机内网 IP（优先返回常见内网网段）"""
    try:
        import subprocess
        result = subprocess.run(
            "ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}'",
            shell=True, capture_output=True, text=True
        )
        ips = result.stdout.strip().split('\n')
        # 优先选择常见内网网段
        for ip in ips:
            if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
                return ip
        # 如果没有找到，返回第一个非 127 的 IP
        return ips[0] if ips and ips[0] else None
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


def get_process_info(pid):
    """获取进程名称和命令行"""
    try:
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
    except:
        pass
    return "unknown", ""


def is_safe_to_kill(pid):
    """判断进程是否可以安全地自动终止
    
    只有当进程明确属于本项目时才返回 True，避免误杀 IDE 服务
    """
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
        'next-router-worker',
        'metadata分析',  # 项目目录名
        'metadata-analysis'
    ]
    
    # 只有命令行参数包含本项目路径或特定关键词时才允许杀死
    if project_root in args:
        return True
    
    if any(kw in args for kw in project_keywords):
        return True
        
    return False


def kill_process_gracefully(pid):
    """优雅地终止进程"""
    try:
        # 1. SIGTERM
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except:
            os.kill(pid, signal.SIGTERM)
        
        # 等待
        for _ in range(10):
            if not is_process_running(pid):
                return True
            time.sleep(0.2)
            
        # 2. SIGKILL
        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except:
            os.kill(pid, signal.SIGKILL)
        return True
    except:
        return False


def stop_services():
    """停止所有服务（仅停止 PID 文件记录的进程）"""
    print("🛑 正在停止服务...")
    
    stopped = False
    # 只通过 PID 文件停止进程
    for pid_file, name in [(BACKEND_PID_FILE, "后端"), (FRONTEND_PID_FILE, "前端")]:
        pid = read_pid(pid_file)
        if pid:
            if is_process_running(pid):
                # hex: 增加安全检查
                if not is_safe_to_kill(pid):
                    print(f"⚠️  PID {pid} 不是本项目服务，跳过终止")
                else:
                    if kill_process_gracefully(pid):
                        print(f"✓ 已停止{name}服务 (PID: {pid})")
                        stopped = True
                    else:
                        print(f"⚠️  无法停止{name} (PID: {pid})")
            
            # 清理 PID 文件
            try:
                os.remove(pid_file)
            except:
                pass
    
    if stopped:
        time.sleep(0.5)
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
    
    # 检查虚拟环境是否存在
    if os.path.exists(VENV_PYTHON):
        python_cmd = VENV_PYTHON
    else:
        python_cmd = "python3"
        print("⚠️  未找到虚拟环境，使用系统 Python")
    
    try:
        # 1. 启动后端
        print("\n🚀 正在启动后端服务...")
        backend_proc = subprocess.Popen(
            f"{python_cmd} run_backend.py",
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
        print("🔗 本机访问: http://localhost:3200")

        local_ip = get_local_ip()
        if local_ip:
            print(f"🌐 内网访问: http://{local_ip}:3200")
        
        print("\n💡 提示: 使用 'venv/bin/python deploy.py stop' 停止服务")
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
