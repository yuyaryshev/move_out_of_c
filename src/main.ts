import { mkdirpSync, readdirSync, readFileSync, renameSync, statSync, symlinkSync, lstatSync } from "fs-extra";

import { yexecSync } from "ystd_server";
// import { exec } from "node:child_process";
import json5 from "json5";
import { sepsToWindowStyle } from "./sepsToWindowStyle";

const configPath = "symlinked.json";

export interface Config {
    targetFolder: string;
    toBeDeletedFolder: string;
    folders: string[];
}
// const configExample = {
//     targetFolder: "f:/C/",
//     toBeDeletedFolder: "c:/TO_BE_DELETED",
//     folders: [
//         "C:/Users/Nname/AppData/Local/Android",
//         // Add more folders here
//     ],
// };

export function checkThatToBeDeletedIsEmpty(toBeDeletedFolder: string) {
    // Check if toBeDeletedFolder is not empty, exit with an error if it is.
    try {
        const toBeDeletedFolderContents = readdirSync(toBeDeletedFolder);
        if (toBeDeletedFolderContents.length > 0) {
            console.error(`Error: ${toBeDeletedFolder} is not empty.`);
            process.exit(1);
        }
    } catch (err) {
        // If the folder doesn't exist, create it.
        mkdirpSync(toBeDeletedFolder);
    }
}

export function robocopy(sourceDir: string, targetDir: string, additionalArgs: string) {
    const cmd = `robocopy "${sourceDir}" "${targetDir}" ${additionalArgs}`;
    try {
        const r = yexecSync(cmd);
    } catch (e: any) {
        const r2 = e.message;
        const indicator = e.stdout
            .split("\n")
            .map((s: string) =>
                s
                    .split(":")
                    .slice(1)
                    .join(":")
                    .split(/\s\s+/)
                    .map((ss: string) => ss.trim()),
            )
            .filter((line: string[]) => Array.isArray(line) && line.length > 4)
            .slice(0, 3)
            .map((line: string[]) => line.slice(-2).join(""))
            .join("");
        if (indicator !== "000000") {
            throw e;
        }
    }
}

export interface SymlinkError {
    sourceDir: string;
    error: string;
}

export function processSymlinkEntry(config: Config, sourceDir: string): SymlinkError | undefined {
    try {
        const folderLStat = lstatSync(sourceDir);
        if (folderLStat.isSymbolicLink()) {
            return { error: "Already a symlink", sourceDir };
        }

        const folderStat = statSync(sourceDir);
        if (folderStat.isDirectory()) {
            const folderRelPath = sourceDir.split(":")[1].slice(1);
            if (!folderRelPath) {
                throw new Error(`CODE00000000 Invalid folder name '${sourceDir}' - skipped`);
            }

            const toBeDeletedDir = `${config.toBeDeletedFolder}\\${folderRelPath}`;
            const toBeDeletedDirParent = toBeDeletedDir.split("\\").slice(0, -1).join("\\");
            const targetDir = `${config.targetFolder}\\${folderRelPath}`;
            mkdirpSync(toBeDeletedDirParent);

            // Rename to and back to test if sourceDir is busy
            renameSync(sourceDir, toBeDeletedDir);
            renameSync(toBeDeletedDir, sourceDir);

            // Copy all files from the sourceDir to the targetFolder.
            robocopy(sourceDir, targetDir, "/mir");

            // Move (rename) the sourceDir to toBeDeletedFolder.
            renameSync(sourceDir, toBeDeletedDir);

            // Create a symlink.
            symlinkSync(targetDir, sourceDir, "junction");
        } else {
            return { error: `Skipping because it is not a plain folder.`, sourceDir };
        }
    } catch (err: any) {
        return { error: err.message, sourceDir };
    }
}

export function main(config0?: Config): SymlinkError[] {
    const errs: SymlinkError[] = [];
    try {
        const config: Config = config0 || json5.parse(readFileSync(configPath, "utf-8"));

        config.targetFolder = sepsToWindowStyle(config.targetFolder);
        config.toBeDeletedFolder = sepsToWindowStyle(config.toBeDeletedFolder);
        for (let i = 0; i < config.folders.length; i++) {
            config.folders[i] = sepsToWindowStyle(config.folders[i]);
        }

        checkThatToBeDeletedIsEmpty(config.toBeDeletedFolder);

        for (const folder of config.folders) {
            const err = processSymlinkEntry(config, folder);
            if (err) {
                errs.push(err);
            }
        }
    } catch (e: any) {
        errs.push({ error: e.message, sourceDir: "" });
    }

    return errs;
}
