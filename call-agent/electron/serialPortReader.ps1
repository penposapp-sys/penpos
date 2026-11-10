$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -TypeDefinition @'
using System;
using System.IO.Ports;
using System.Threading;

public sealed class PenPosSerialLineReader
{
    private readonly SerialPort port;
    private Thread thread;

    public PenPosSerialLineReader(SerialPort serialPort)
    {
        port = serialPort;
    }

    public void Start()
    {
        thread = new Thread(ReadLoop);
        thread.IsBackground = true;
        thread.Start();
    }

    private void ReadLoop()
    {
        while (port.IsOpen)
        {
            try
            {
                string line = port.ReadLine();
                if (!String.IsNullOrWhiteSpace(line))
                {
                    string normalizedLine = line.TrimEnd('\r');
                    int jsonStart = normalizedLine.IndexOf("{\"version\":", StringComparison.Ordinal);
                    if (jsonStart > 0)
                    {
                        normalizedLine = normalizedLine.Substring(jsonStart);
                    }
                    lock (Console.Out)
                    {
                        Console.Out.WriteLine(normalizedLine);
                    }
                }
            }
            catch (TimeoutException)
            {
            }
            catch (Exception exception)
            {
                if (port.IsOpen)
                {
                    lock (Console.Out)
                    {
                        Console.Out.WriteLine("{\"serialError\":\"" + EscapeJson(exception.Message) + "\"}");
                    }
                }
                return;
            }
        }
    }

    private static string EscapeJson(string value)
    {
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"")
            .Replace("\r", " ").Replace("\n", " ");
    }

    public void Join(int milliseconds)
    {
        if (thread != null && thread.IsAlive)
        {
            thread.Join(milliseconds);
        }
    }
}
'@

$port = $null
$reader = $null

try {
  $port = New-Object System.IO.Ports.SerialPort -ArgumentList @(
    $env:PENPOS_PORT_NAME,
    9600,
    [System.IO.Ports.Parity]::None,
    8,
    [System.IO.Ports.StopBits]::One
  )
  $port.Encoding = New-Object System.Text.UTF8Encoding($false)
  $port.NewLine = "`n"
  $port.ReadTimeout = 500
  $port.WriteTimeout = 1000
  $port.Open()

  $reader = New-Object PenPosSerialLineReader -ArgumentList $port
  $reader.Start()

  [Console]::Out.WriteLine('{"ok":true}')
  while ($true) {
    $command = [Console]::In.ReadLine()
    if ($null -eq $command -or $command -eq 'CLOSE') {
      break
    }
    if ($command.StartsWith('COMMAND ')) {
      $serialCommand = $command.Substring(8)
      if ($serialCommand -match '^(LEARN [ABC]|LEARN OFF|LEARN STATUS|LEARN CLEAR [ABC])$') {
        $port.WriteLine($serialCommand)
      }
    }
  }
} catch {
  $message = [string]$_.Exception.Message
  $escapedMessage = $message.Replace('\', '\\').Replace('"', '\"').Replace("`r", ' ').Replace("`n", ' ')
  [Console]::Out.WriteLine('{"ok":false,"error":"' + $escapedMessage + '"}')
  exit 1
} finally {
  if ($port -and $port.IsOpen) {
    $port.Close()
  }
  if ($reader) {
    $reader.Join(2000)
  }
  if ($port) {
    $port.Dispose()
  }
}

[Console]::Out.WriteLine('{"closed":true}')
