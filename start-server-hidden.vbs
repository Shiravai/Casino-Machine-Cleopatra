' Cleopatra's Gold - starts the phone server silently in the background.
' A copy of this file sits in the Startup folder so it runs on every login.
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\shirk\Desktop\Casino"
shell.Run """C:\Program Files\nodejs\node.exe"" server.js", 0, False
