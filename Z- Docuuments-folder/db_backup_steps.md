Download & install from:
👉 https://www.mongodb.com/try/download/database-tools


After installation, verify:
mongodump --version



Connect with MongoDB Shell:(connection string):
mongosh "mongodb+srv://crmdepllc_db_user:98SxeRD5lSM2vg03@cluster01.xlwz98m.mongodb.net/digi_era_pro?retryWrites=true&w=majority&appName=Cluster01"



Run backup command:
mongodump --uri=mongodb+srv://crmdepllc_db_user:98SxeRD5lSM2vg03@cluster01.xlwz98m.mongodb.net/digi_era_pro?retryWrites=true&w=majority&appName=Cluster01" --out=mongodb_backup

mongodump --uri=[Connection_String] --out=[folder]



Restore Command
mongorestore --uri="mongodb+srv://crmdepllc_db_user:98SxeRD5lSM2vg03@cluster01.xlwz98m.mongodb.net/digi_era_pro?retryWrites=true&w=majority&appName=Cluster01" --dir="C:\mongodb_backup\digi_era_pro" 


mongorestore --uri=[Connection_string] --dir=[folder]