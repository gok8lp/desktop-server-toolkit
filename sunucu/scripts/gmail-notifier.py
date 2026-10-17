import os
import pickle
import base64
import requests
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from langdetect import detect

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
CREDENTIALS_FILE = '${CREDENTIALS_FILE}'
TOKEN_FILE = '${TOKEN_FILE}'
WHATSAPP_NUMBER = '<TELEFON>'
CALLMEBOT_API_KEY = '<CALLMEBOT_APIKEY>'
GEMINI_API_KEY = '${GEMINI_API_KEY}'

SKIP_SENDERS = [
    'myanimelist', 'ebay', 'google', 'noreply@google',
    'info@myanimelist', 'noreply@ebay'
]

def should_skip(sender):
    sender_lower = sender.lower()
    return any(skip in sender_lower for skip in SKIP_SENDERS)

def send_whatsapp(message):
    url = f"https://api.callmebot.com/whatsapp.php?phone={WHATSAPP_NUMBER}&text={requests.utils.quote(message)}&apikey={CALLMEBOT_API_KEY}"
    requests.get(url)

def translate_with_gemini(text):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{
                "text": f"Sadece bu metni Türkçeye çevir, başka hiçbir şey ekleme: {text}"
            }]
        }]
    }
    response = requests.post(url, json=payload)
    return response.json()['candidates'][0]['content']['parts'][0]['text']

def get_gmail_service():
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
    return build('gmail', 'v1', credentials=creds)

def get_body(message):
    body = ''
    payload = message['payload']
    if 'parts' in payload:
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain':
                data = part['body'].get('data', '')
                if data:
                    body = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')[:1000]
                    break
    elif 'body' in payload:
        data = payload['body'].get('data', '')
        if data:
            body = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')[:1000]
    return body.strip()

def check_new_emails():
    service = get_gmail_service()
    results = service.users().messages().list(userId='me', q='is:unread', maxResults=10).execute()
    messages = results.get('messages', [])

    for msg in messages:
        message = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        headers = message['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Konu yok')
        sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Bilinmiyor')

        if should_skip(sender):
            print(f"Atlandı: {sender}")
            service.users().messages().modify(userId='me', id=msg['id'], body={'removeLabelIds': ['UNREAD']}).execute()
            continue

        body = get_body(message)
        content = f"Konu: {subject}\nGönderen: {sender}\n\n{body}"

        try:
            lang = detect(body) if body else 'tr'
        except:
            lang = 'tr'

        if lang == 'en':
            turkish = translate_with_gemini(content)
            whatsapp_msg = f"📧 Yeni Mail\n\n🇬🇧 {content}\n\n🇹🇷 {turkish}"
        else:
            whatsapp_msg = f"📧 Yeni Mail\n\n{content}"

        send_whatsapp(whatsapp_msg[:4000])
        service.users().messages().modify(userId='me', id=msg['id'], body={'removeLabelIds': ['UNREAD']}).execute()

if __name__ == '__main__':
    check_new_emails()
