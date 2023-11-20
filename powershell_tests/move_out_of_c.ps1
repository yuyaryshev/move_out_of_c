# Define constants
$targetFolderBase = "g:\C\"
$toBeDeletedFolderBase = "c:\TO_BE_DELETED\"

# Check if toBeDeletedFolder exists and create it if it doesn't
if (-not (Test-Path -Path $toBeDeletedFolderBase)) {
    New-Item -Path $toBeDeletedFolderBase -ItemType Directory
}

# Function to check if a file is in use
function IsFileInUse($file) {
    try {
        $fileStream = [System.IO.File]::Open($file, 'Open', 'Read', 'None')
        $fileStream.Close()
        $false
    }
    catch {
        $true
    }
}

# Read the symlinked.txt file and process each line
Get-Content "symlinked.txt" | ForEach-Object {
    $folder = $_
    $targetFolder = Join-Path $targetFolderBase ($folder -replace "^C:", "")
    $toBeDeletedFolder = Join-Path $toBeDeletedFolderBase ($folder -replace "^C:", "")

    # Check if the folder exists
    if (Test-Path -Path $folder) {
        # Check if any files inside the folder are in use
        $inUseFiles = Get-ChildItem $folder -File | Where-Object { IsFileInUse $_.FullName }

        if ($inUseFiles.Count -gt 0) {
            Write-Host "Folder $folder contains files that are in use. Skipping..."
            return
        }

        # Copy all files from the folder to targetFolder using robocopy
        robocopy $folder $targetFolder /MIR

        # Ensure that folder contents are the same
        Compare-Object (Get-ChildItem $folder -File) (Get-ChildItem $targetFolder -File) -Property Name, Length | ForEach-Object {
            Write-Host "File $($_.Name) in $folder and $targetFolder is different. Data safety may be compromised."
        }

        # Move the folder to toBeDeletedFolder
        Move-Item $folder $toBeDeletedFolder

        # Create a symlink
        cmd /c mklink /d $folder $targetFolder
        Write-Host "Created symlink for $folder"
    } else {
        Write-Host "Folder $folder does not exist. Skipping..."
    }
}
