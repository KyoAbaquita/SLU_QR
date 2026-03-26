**node server.js** - Start the system copy the localhost:3000





**Server Error** 



( throw er; // Unhandled 'error' event

&#x20;     ^



Error: listen EADDRINUSE: address already in use 0.0.0.0:3000

&#x20;   at Server.setupListenHandle \[as \_ ...



&#x20; code: 'EADDRINUSE',

&#x20; errno: -4091,

&#x20; syscall: 'listen',

&#x20; address: '0.0.0.0',

&#x20; port: 3000 )





**Copy \& Paste** 



netstat -ano | findstr ":3000 " | findstr "LISTENING" | ForEach-Object { ($\_ -split '\\s+')\[-1] } | ForEach-Object { taskkill /PID $\_ /F }; Start-Sleep -Milliseconds 800; node server.js




**Display Screen**
http://localhost:3000/display



