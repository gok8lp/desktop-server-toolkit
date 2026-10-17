from google_auth_oauthlib.flow import InstalledAppFlow
import pickle

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
CREDENTIALS_FILE = '${CREDENTIALS_FILE}'
TOKEN_FILE = '${TOKEN_FILE}'

flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
auth_url, _ = flow.authorization_url(prompt='consent')

print("Bu URL'yi tarayıcında aç:")
print(auth_url)
print()
code = input("Kodu gir: ")

flow.fetch_token(code=code)
creds = flow.credentials

with open(TOKEN_FILE, 'wb') as token:
    pickle.dump(creds, token)

print("Token kaydedildi!")
