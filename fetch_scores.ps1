# Fetches score snapshots for all posts/comments from the Arctic Shift archive API
# and writes viz\data.js containing the merged dataset.

$ErrorActionPreference = "Stop"
$exportDir = "G:\RedditData\export_gregbahm_20260803"
$outFile = "G:\RedditData\viz\data.js"

Write-Host "Loading CSVs..."
$posts = Import-Csv (Join-Path $exportDir "posts.csv")
$comments = Import-Csv (Join-Path $exportDir "comments.csv")
Write-Host "  $($posts.Count) posts, $($comments.Count) comments"

function Get-Field($ids, $endpoint, $field) {
    $map = @{}
    $batchSize = 100
    for ($i = 0; $i -lt $ids.Count; $i += $batchSize) {
        $batch = $ids[$i..([Math]::Min($i + $batchSize - 1, $ids.Count - 1))]
        $url = "https://arctic-shift.photon-reddit.com/api/$endpoint/ids?ids=$($batch -join ',')&fields=id,$field"
        $ok = $false
        for ($attempt = 1; $attempt -le 5; $attempt++) {
            try {
                $resp = Invoke-RestMethod -Uri $url -TimeoutSec 60
                foreach ($item in $resp.data) { $map[$item.id] = $item.$field }
                $ok = $true
                break
            } catch {
                Write-Host "  batch at $i failed (attempt $attempt): $($_.Exception.Message)"
                Start-Sleep -Seconds (2 * $attempt)
            }
        }
        if (-not $ok) { throw "Batch at offset $i failed after 5 attempts" }
        Write-Host "  $endpoint/$field`: $([Math]::Min($i + $batchSize, $ids.Count))/$($ids.Count)"
        Start-Sleep -Milliseconds 250
    }
    return $map
}

$postScores = Get-Field @($posts | ForEach-Object { $_.id }) "posts" "score"
$commentScores = Get-Field @($comments | ForEach-Object { $_.id }) "comments" "score"

# thread titles for comments: the thread's post id is embedded in each comment's link URL
$threadIds = @($comments | ForEach-Object {
    if ($_.link -match '/comments/([a-z0-9]+)') { $Matches[1] }
} | Sort-Object -Unique)
Write-Host "  $($threadIds.Count) unique threads"
$threadTitles = Get-Field $threadIds "posts" "title"

Write-Host "Merging..."
$items = New-Object System.Collections.Generic.List[object]
$missing = 0

foreach ($p in $posts) {
    if (-not $postScores.ContainsKey($p.id)) { $missing++; continue }
    $items.Add([PSCustomObject]@{
        id = $p.id; type = "post"; date = $p.date; sub = $p.subreddit
        title = $p.title; body = $p.body; score = $postScores[$p.id]
        link = $p.permalink
    })
}
foreach ($c in $comments) {
    if (-not $commentScores.ContainsKey($c.id)) { $missing++; continue }
    $thread = ""
    if ($c.link -match '/comments/([a-z0-9]+)' -and $threadTitles.ContainsKey($Matches[1])) {
        $thread = $threadTitles[$Matches[1]]
    }
    $items.Add([PSCustomObject]@{
        id = $c.id; type = "comment"; date = $c.date; sub = $c.subreddit
        title = ""; body = $c.body; score = $commentScores[$c.id]
        link = $c.permalink; thread = $thread
    })
}

Write-Host "  $($items.Count) items with scores, $missing not found in archive"

New-Item -ItemType Directory -Force (Split-Path $outFile) | Out-Null
$json = ConvertTo-Json $items -Depth 3 -Compress
[System.IO.File]::WriteAllText($outFile, "const REDDIT_DATA = $json;", [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $outFile ($([Math]::Round((Get-Item $outFile).Length / 1MB, 1)) MB)"
