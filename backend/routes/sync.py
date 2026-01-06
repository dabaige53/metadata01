"""
同步管理 API
提供 Tableau 元数据同步触发接口
"""

import threading
from datetime import datetime
from flask import jsonify, request
from sqlalchemy import text

from . import api_bp
from backend.models import get_session, get_engine, SyncLog
from backend.config import Config


# 同步状态管理
_sync_status = {
    "is_running": False,
    "started_at": None,
    "progress": None,
    "error": None,
    "last_completed": None,
}
_sync_lock = threading.Lock()


def _run_sync_task():
    """后台执行同步任务"""
    global _sync_status

    try:
        from backend.services.tableau_client import TableauMetadataClient
        from backend.services.sync_manager import MetadataSync

        _sync_status["progress"] = "正在连接 Tableau Server..."

        client = TableauMetadataClient(
            base_url=Config.TABLEAU_BASE_URL,
            pat_name=Config.TABLEAU_PAT_NAME,
            pat_secret=Config.TABLEAU_PAT_SECRET,
        )

        client.sign_in()
        _sync_status["progress"] = "连接成功，开始同步..."

        sync = MetadataSync(client, db_path=Config.DATABASE_PATH)

        # 执行全量同步
        sync.sync_all()
        sync.close()

        client.sign_out()

        _sync_status["progress"] = "同步完成"
        _sync_status["last_completed"] = datetime.now().isoformat()
        _sync_status["error"] = None

    except Exception as e:
        _sync_status["error"] = str(e)
        _sync_status["progress"] = f"同步失败: {e}"
        import traceback

        traceback.print_exc()
    finally:
        with _sync_lock:
            _sync_status["is_running"] = False


@api_bp.route("/sync", methods=["POST"])
def trigger_sync():
    """触发 Tableau 元数据同步

    POST /api/sync

    Returns:
        - 200: 同步已启动
        - 409: 同步正在进行中
        - 500: 配置错误
    """
    global _sync_status

    # 检查配置
    if not Config.TABLEAU_BASE_URL or not Config.TABLEAU_PAT_NAME:
        return jsonify(
            {"success": False, "error": "Tableau 配置缺失，请检查 .env 文件"}
        ), 500

    with _sync_lock:
        if _sync_status["is_running"]:
            return jsonify(
                {"success": False, "error": "同步正在进行中", "status": _sync_status}
            ), 409

        _sync_status["is_running"] = True
        _sync_status["started_at"] = datetime.now().isoformat()
        _sync_status["progress"] = "初始化..."
        _sync_status["error"] = None

    # 启动后台线程执行同步
    thread = threading.Thread(target=_run_sync_task, daemon=True)
    thread.start()

    return jsonify({"success": True, "message": "同步已启动", "status": _sync_status})


@api_bp.route("/sync/status", methods=["GET"])
def get_sync_status():
    """获取同步状态

    GET /api/sync/status

    Returns:
        当前同步状态信息
    """
    # 获取最近的同步日志
    engine = get_engine(Config.DATABASE_PATH)
    session = get_session(engine)

    try:
        last_sync = session.query(SyncLog).order_by(SyncLog.started_at.desc()).first()
        last_sync_info = None
        if last_sync:
            last_sync_info = {
                "type": last_sync.sync_type,
                "status": last_sync.status,
                "started_at": last_sync.started_at.isoformat()
                if last_sync.started_at
                else None,
                "completed_at": last_sync.completed_at.isoformat()
                if last_sync.completed_at
                else None,
                "records": last_sync.records_synced,
                "error": last_sync.error_message,
            }

        # 获取同步统计
        sync_stats = session.execute(
            text("""
            SELECT sync_type, status, COUNT(*) as count, MAX(started_at) as last_run
            FROM sync_logs
            GROUP BY sync_type, status
            ORDER BY last_run DESC
        """)
        ).fetchall()

        return jsonify(
            {
                "current": _sync_status,
                "last_sync": last_sync_info,
                "history": [
                    {
                        "type": row[0],
                        "status": row[1],
                        "count": row[2],
                        "last_run": row[3],
                    }
                    for row in sync_stats[:10]
                ],
            }
        )
    finally:
        session.close()


@api_bp.route("/sync/logs", methods=["GET"])
def get_sync_logs():
    """获取同步日志

    GET /api/sync/logs?limit=50

    Returns:
        同步日志列表
    """
    limit = request.args.get("limit", 50, type=int)

    engine = get_engine(Config.DATABASE_PATH)
    session = get_session(engine)

    try:
        logs = (
            session.query(SyncLog)
            .order_by(SyncLog.started_at.desc())
            .limit(limit)
            .all()
        )

        return jsonify(
            {
                "logs": [
                    {
                        "id": log.id,
                        "type": log.sync_type,
                        "status": log.status,
                        "started_at": log.started_at.isoformat()
                        if log.started_at
                        else None,
                        "completed_at": log.completed_at.isoformat()
                        if log.completed_at
                        else None,
                        "records": log.records_synced,
                        "error": log.error_message,
                    }
                    for log in logs
                ]
            }
        )
    finally:
        session.close()
