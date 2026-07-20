#!/bin/bash
# moji 一键启停脚本
# 用法:  ./moji.sh start   启动（后台运行，改代码自动热更新）
#        ./moji.sh stop    停止
#        ./moji.sh status  看现在是开是关
#        ./moji.sh log     出问题时看最近的日志

cd "$(dirname "$0")" || exit 1

case "$1" in
  start)
    if lsof -ti :5173 >/dev/null 2>&1; then
      echo "moji 已经在运行了 → http://localhost:5173"
      exit 0
    fi
    # nohup + & 让服务在后台运行，日志写进 .moji.log（关掉终端也不受影响）
    nohup npm run dev > .moji.log 2>&1 &
    echo "正在启动……"
    for _ in $(seq 1 30); do
      if curl -sf http://localhost:5173 >/dev/null 2>&1; then
        echo "moji 已启动 → http://localhost:5173"
        exit 0
      fi
      sleep 1
    done
    echo "30 秒内没启动成功，运行 ./moji.sh log 看看日志里说了什么"
    exit 1
    ;;
  stop)
    # 按端口找进程：3001 是后端，5173 是前端，谁占着就停谁
    # 注意：每个端口要单独一个 -i，macOS 的 lsof 不认 "-i :a :b" 的写法
    pids=$(lsof -t -i :3001 -i :5173 2>/dev/null)
    if [ -z "$pids" ]; then
      echo "moji 本来就没在运行。"
    else
      echo "$pids" | xargs kill
      echo "moji 已停止。"
    fi
    ;;
  status)
    if lsof -ti :5173 >/dev/null 2>&1; then
      echo "运行中 → http://localhost:5173"
    else
      echo "未运行"
    fi
    ;;
  log)
    tail -40 .moji.log
    ;;
  *)
    echo "用法: ./moji.sh start|stop|status|log"
    exit 1
    ;;
esac
