#!/bin/bash
GOTIFY_URL="http://localhost:8482"
GOTIFY_TOKEN="${GOTIFY_TOKEN}"

MESSAGE=$(cat)
SUBJECT="${SMARTD_SUBJECT:-SMART Uyarısı}"
DEVICE="${SMARTD_DEVICE:-?}"

curl -s -X POST "${GOTIFY_URL}/message?token=${GOTIFY_TOKEN}" \
  -F "title=! ${SUBJECT}" \
  -F "message=Cihaz: ${DEVICE}

${MESSAGE}" \
  -F "priority=8" > /dev/null
