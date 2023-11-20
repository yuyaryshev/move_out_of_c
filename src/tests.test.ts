import { expect } from "chai";
import { expectDeepEqual } from "ystd";
import { describe, before, after, it } from "mocha";
import { main, Config, processSymlinkEntry, checkThatToBeDeletedIsEmpty } from "./main";
import * as fs from "fs-extra";
import * as childProcess from "node:child_process";

const testSourceRoot = "C:\\test_folder";
const testTargetRoot = "g:\\C\\test_folder";
const testConfig: Config = {
    targetFolder: "g:\\C",
    toBeDeletedFolder: "c:\\TO_BE_DELETED",
    folders: [
        "C:\\test_folder\\test1",
        // Add more folders here
    ],
};

const sourceTestFolder = testConfig.folders[0];
const targetTestFolder = testConfig.targetFolder + testConfig.folders[0].split("C:").join("");

const deleteAllTestFolders = () => {
    fs.removeSync(testSourceRoot);
    fs.removeSync(testConfig.toBeDeletedFolder);
    fs.removeSync(testTargetRoot);
};

const createTestFiles = () => {
    fs.mkdirpSync(sourceTestFolder);
    fs.writeFileSync(`${sourceTestFolder}/file1.txt`, "Test content");
};

describe("Test Suite", () => {
    before(async () => {
        deleteAllTestFolders();
        createTestFiles();
    });

    after(async () => {
        deleteAllTestFolders();
    });

    it("Test 1: Successful scenario", async () => {
        const errs = main(testConfig);
        expectDeepEqual(errs.length, 0);

        const targetFileExists = fs.existsSync(`${targetTestFolder}\\file1.txt`);
        expectDeepEqual(targetFileExists, true);

        const symlinkContent = await fs.readFile(`${sourceTestFolder}\\file1.txt`, "utf8");
        expectDeepEqual(symlinkContent, "Test content");

        const toBeDeletedFileExists = fs.existsSync(`${testConfig.toBeDeletedFolder}\\test_folder\\test1\\file1.txt`);
        expectDeepEqual(toBeDeletedFileExists, true);
    });

    it("Test 2: Failure tolerance in case symlink already exists", async () => {
        fs.removeSync(testConfig.toBeDeletedFolder);

        const errs = main(testConfig);
        expectDeepEqual(errs.length, 1);

        const targetFileExists = fs.existsSync(`${targetTestFolder}\\file1.txt`);
        expectDeepEqual(targetFileExists, true);
    });

    it("Test 3: Failure tolerance in case a file is busy", async () => {
        deleteAllTestFolders();
        createTestFiles();

        const fileStream = await fs.createReadStream(`${sourceTestFolder}\\file1.txt`);

        const errs = main(testConfig);

        expectDeepEqual(errs.length, 1);

        // Expect it to not do anything but error reporting
        const targetFileExists = fs.existsSync(`${targetTestFolder}\\file1.txt`);

        expectDeepEqual(targetFileExists, false);
        fileStream.close();
    });
});
