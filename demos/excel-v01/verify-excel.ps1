param([Parameter(Mandatory=$true)][string]$DemoRoot, [switch]$Exercise)
. "$env:USERPROFILE\.codex\scripts\Enter-CodexUtf8.ps1"
$ErrorActionPreference = 'Stop'
$readingDemoRoot = (Resolve-Path -LiteralPath $DemoRoot).Path
$readingWorkbookPath = Join-Path $readingDemoRoot 'Deep Literature 文献管理 Demo.xlsx'
$readingExcel = $null
$readingBook = $null
try {
    $readingExcel = New-Object -ComObject Excel.Application
    $readingExcel.Visible = $false
    $readingExcel.DisplayAlerts = $false
    $readingExcel.AutomationSecurity = 3
    $readingBook = $readingExcel.Workbooks.Open($readingWorkbookPath, 0, $false)
    $readingExcel.CalculateFullRebuild()
    $readingSheet = $readingBook.Worksheets.Item('文献')
    if ([int]$readingSheet.Range('B4').Value2 -ne 6) { throw 'paper_count_incorrect' }
    if ($readingSheet.Range('F8').Text -ne '打开') { throw 'hyperlink_display_incorrect' }
    if ($readingSheet.Range('H8').Text -ne '6 条') { throw 'record_link_incorrect' }
    if ($readingBook.Worksheets.Item('_同步').Visible -ne 2) { throw 'snapshot_not_hidden' }
    if (-not $readingSheet.Columns.Item('S').Hidden) { throw 'paper_identity_not_hidden' }
    $readingLabelsPath = Join-Path $readingDemoRoot 'link-labels.json'
    if (Test-Path -LiteralPath $readingLabelsPath) {
        $readingLabels = Get-Content -LiteralPath $readingLabelsPath -Encoding UTF8 -Raw | ConvertFrom-Json
        foreach ($readingLabel in $readingLabels) {
            if ($readingBook.Worksheets.Item($readingLabel.sheet).Range($readingLabel.address).Value2 -ne $readingLabel.label) { throw ('native_link_value_mismatch: ' + $readingLabel.address) }
        }
    }
    if ($Exercise) {
        $readingSheet.Range('C8').Value2 = '待复读'
        $readingSheet.Range('E8').Value2 = 'Native Excel 排序后核对图表。'
        $readingSheet.Range('P8').Value2 = 'native_excel_roundtrip_个人笔记'
        $readingSort = $readingSheet.ListObjects.Item('LiteratureTable').Sort
        $readingSort.SortFields.Clear()
        $readingSort.SortFields.Add($readingSheet.Range('A8:A13'), 0, 2) | Out-Null
        $readingSort.Header = 1
        $readingSort.Apply()
        $readingExcel.CalculateFullRebuild()
        if ([int]$readingSheet.Range('E4').Value2 -ne 2) { throw 'reading_count_after_edit_incorrect' }
    }
    $readingSheet.Activate()
    $readingExcel.ActiveWindow.Zoom = 85
    $readingExcel.ActiveWindow.ScrollRow = 1
    $readingExcel.ActiveWindow.ScrollColumn = 1
    $readingSheet.Range('A1').Select()
    if (-not $Exercise) {
        $readingViews = @(
            @{Name='文献'; Range='A1:K14'; File='literature-native.pdf'},
            @{Name='阅读成果'; Range='A1:I14'; File='reading-native.pdf'},
            @{Name='图表索引'; Range='A1:J13'; File='figures-native.pdf'},
            @{Name='说明'; Range='A1:B17'; File='instructions-native.pdf'}
        )
        foreach ($readingView in $readingViews) {
            $readingPage = $readingBook.Worksheets.Item($readingView.Name)
            $readingPage.PageSetup.Orientation = 2
            $readingPage.PageSetup.Zoom = $false
            $readingPage.PageSetup.FitToPagesWide = 1
            $readingPage.PageSetup.FitToPagesTall = 1
            $readingPage.PageSetup.PrintArea = $readingView.Range
            $readingPage.PageSetup.LeftMargin = 15
            $readingPage.PageSetup.RightMargin = 15
            $readingPage.PageSetup.TopMargin = 15
            $readingPage.PageSetup.BottomMargin = 15
            $readingPage.ExportAsFixedFormat(0, (Join-Path $readingDemoRoot $readingView.File))
        }
    }
    $readingSheet.Activate()
    $readingSheet.Range('A1').Select()
    $readingBook.Save()
    [ordered]@{status='success';native_excel=$readingExcel.Version;exercise=[bool]$Exercise;sheets=$readingBook.Worksheets.Count;path=$readingWorkbookPath} | ConvertTo-Json
}
finally {
    if ($null -ne $readingBook) { $readingBook.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($readingBook) }
    if ($null -ne $readingExcel) { $readingExcel.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($readingExcel) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
