export const getPrintersSettings = async (req, res) => {
  const downloadUrl = String(
    process.env.PRINT_AGENT_WINDOWS_URL ||
      'http://localhost:4000/public/downloads/PenPOS_PrintAgent_Setup_0.1.0.exe'
  ).trim()
  res.json({
    success: true,
    printAgent: {
      pcPrinter: {
        platform: 'windows',
        downloadUrl
      }
    }
  })
}
