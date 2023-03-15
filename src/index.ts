#! /usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob"
import { textSync } from "figlet"
import { Command } from "commander";

type TerraformItem = {
    source: string,
    version: string,
    variant: string,
    file: string
}

async function getTerraformFiles(startingPath: string) {
    let directories = await glob(startingPath + "/**/*.tf")
    let projectRoot = `${startingPath.split("/").pop()}`

    let finalItems: TerraformItem[] = [];

    directories.forEach(filename => {
        let directoriesToAdd = getVersionsSrc(filename, projectRoot)
        finalItems = finalItems.concat(directoriesToAdd)
    })

    // console.log(`FINAL ITEMS: ${finalItems}`)

    writeFileSync("lading.json", JSON.stringify({"project": projectRoot, "tf-items": finalItems, "updated": new Date()}, null, 2))

}

function getVersionsSrc(filePath: string, projectRoot: string): TerraformItem[] {
    let contents = readFileSync(filePath, 'utf8');
    // grab a line, that when stripped starts with source = and grab what comes after (if ?ref= in the string split on it and trim the " of the end to get the version)
    // if the next line starts with version = when stripped grab what comes after and include it as the optional version

    let shouldGrabVersion = false;

    let contentLines = contents.split("\n")

    let fileLocation = filePath.split(projectRoot)[1]

    let tfmap: TerraformItem[] = []
    let currentProviderString = ""
    let currentVariant = "provider"

    contentLines.forEach(line => {
        line = line.trim()

        if (line.includes("provider")) {
            currentVariant = "provider"
        }
        if (line.includes("module")) {
            currentVariant = "module"
        }
        // console.log(`Starting for line: ${line}`)
        if (line.startsWith("source ")) {
            
            let currentItemString = line.split(" = ")[1].split("\"").join("").trim()
            // console.log(`Started with source and currentItemString is now: ${currentItemString}`)
            if (currentItemString.includes("?ref=")) {
                
                // This is a module and we should grab the version
                let tfItemList = currentItemString.split("?ref=")
                let revisionString = tfItemList[1]
                let sourceString = tfItemList[0]
                // console.log(`Line contained ref and is split to: ${tfItemList}`)

                tfmap.push({"source": sourceString, "version": revisionString, "variant": currentVariant, "file": fileLocation})
                shouldGrabVersion = false
            }
            else {
                shouldGrabVersion = true
            }

            currentProviderString = currentItemString

        }
        else if (line.startsWith("version ") && shouldGrabVersion) {
            
            let currentItemVersion = line.split(" = ")[1].split("\"").join("").trim()
            tfmap.push({"source": currentProviderString, "version": currentItemVersion, "variant": currentVariant, "file": fileLocation})
            // console.log(`Line started with version and version is: ${currentItemVersion}`)
            shouldGrabVersion = false;
        }
        else if (shouldGrabVersion) {
            tfmap.push({"source": currentProviderString, "version": "latest", "variant": currentVariant, "file": fileLocation})
            shouldGrabVersion = false;
        }
        else {
            shouldGrabVersion = false
        }
    });

    // console.log(`${JSON.stringify(tfmap)}`);

    return tfmap

}

console.log(textSync("Lading"));

const program = new Command()

program
    .version("0.0.1")
    .description("A CLI to get all terraform module and provider versions and dependencies for a project")
    .option("-d --directory [directory]", "Build a lading.json file given the project path. If no value is added we use the current directory.")
    .parse(process.argv)

const options = program.opts();

// console.log(`${JSON.stringify(options)}`)

if (options.directory) {
    const filepath = typeof options.directory === "string" ? options.directory : process.cwd();
    console.log(`\nRunning lading at ${filepath}`)
    getTerraformFiles(filepath)
}

if (!process.argv.slice(2).length) {
    program.outputHelp();
}

// getTerraformFiles("/Users/hannahmerritt/Development/learn-terraform-provision-eks-cluster")

