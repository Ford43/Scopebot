param([string]$Deck='candidate.pptx',[string]$Out='office_render')
$base='C:\Users\keror\Documents\GitHub\Scopebot\artifacts\presentation_rebuild'
$target=Join-Path $base $Out
New-Item -ItemType Directory -Force -Path $target | Out-Null
$app=New-Object -ComObject PowerPoint.Application
try {
  $ppt=$app.Presentations.Open((Join-Path $base $Deck),$true,$false,$false)
  try {
    $ppt.Export($target,'PNG',1600,900)
    $ppt.SaveAs((Join-Path $target 'ScopeBot.pdf'),32)
    Write-Output ('Slides: '+$ppt.Slides.Count)
  } finally { $ppt.Close() }
} finally { $app.Quit() }
