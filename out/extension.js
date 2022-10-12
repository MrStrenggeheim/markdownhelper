"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickString = exports.executePandocRawData = exports.executePandoc = exports.parseYamlHeader = exports.getYamlHeaderData = exports.createFullHeader = exports.getAuthors = exports.getTitle = exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
let mhlog = vscode.window.createOutputChannel("MarkdownHelper Log");
// this method is called when your extension is activated
function activate(context) {
    console.log('Markdownhelper is now active!');
    // Start Live File View
    let startLiveFileViewCommand = vscode.commands.registerCommand('markdownhelper.startLiveFileView', () => __awaiter(this, void 0, void 0, function* () {
        const path = require("path");
        const fs = require("fs");
        // html file path
        let htmlFilePath = "";
        yield vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Live View',
            filters: {
                'Web files': ['html'],
                'All files': ['*']
            }
        }).then(fileUri => {
            if (fileUri && fileUri[0]) {
                htmlFilePath = fileUri[0].fsPath;
            }
        });
        if (htmlFilePath == "") {
            vscode.window.showErrorMessage("Could not load LiveView file");
            return;
        }
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel('markdownhelperLiveView', // Identifies the type of the webview. Used internally
        'Live View', // Title of the panel displayed to the user
        vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
        {} // Webview options. More on these later.
        );
        const updateWebview = () => {
            panel.title = path.parse(htmlFilePath).name;
            panel.webview.html = fs.readFileSync(htmlFilePath, 'utf8');
        };
        updateWebview();
        var watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(htmlFilePath), '*'));
        watcher.onDidChange(() => {
            updateWebview();
        });
        watcher.onDidDelete(() => {
            watcher.dispose();
            panel.dispose();
            vscode.window.showInformationMessage("File deleted. Build again!");
        });
        // const interval = setInterval(updateWebview, 99000);
        panel.onDidDispose(() => {
            // When the panel is closed, cancel any future updates to the webview content
            // clearInterval(interval);
            watcher.dispose();
        }, null, context.subscriptions);
    }));
    let startLiveEditorViewCommand = vscode.commands.registerCommand('markdownhelper.startLiveEditorView', () => __awaiter(this, void 0, void 0, function* () {
        const path = require("path");
        const fs = require("fs");
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel('markdownhelperLiveView', // Identifies the type of the webview. Used internally
        'Live View', // Title of the panel displayed to the user
        vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
        {} // Webview options. More on these later.
        );
        const updateWebview = () => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            let activeFileName = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.fileName;
            if (!activeFileName) {
                vscode.window.showErrorMessage("Could not find active File");
                return;
            }
            // read file
            let fileContents = (_b = vscode.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document.getText();
            if (!fileContents) {
                vscode.window.showErrorMessage("Could not read active document");
                return;
            }
            let data = getYamlHeaderData(fileContents);
            console.log(data);
            let pandocArgs = yield parseYamlHeader(data, false);
            console.log("args: " + pandocArgs);
            // panel.title = path.parse(activeFileName).name;
            const callback = (error, result) => {
                if (error) {
                    console.error(error);
                    return;
                }
                console.log("Executed with args:\n" + pandocArgs.toString());
                // mhlog.appendLine("Executed with args:\n" + pandocArgs.toString());
                panel.webview.html = result;
                return /*console.log("result: " + result),*/ result;
            };
            executePandocRawData(fileContents, pandocArgs, callback);
        });
        updateWebview();
        // if setting update view is onType then update on every keystroke else update on save
        let settings = vscode.workspace.getConfiguration('markdownhelper');
        let listener;
        if (settings.get('live-editor-view-update') == "onType") {
            // create a listener for every keystroke
            listener = vscode.workspace.onDidChangeTextDocument((e) => {
                // if (e.document.languageId === "markdown" && e.document.uri.scheme === "file") {
                updateWebview();
                console.log("changed");
                // }
            });
        }
        else if (settings.get('live-editor-view-update') == "onSave") {
            listener = vscode.workspace.onDidSaveTextDocument((document) => {
                if (document.languageId === "markdown" && document.uri.scheme === "file") {
                    updateWebview();
                    console.log("saved");
                }
            });
        }
        listener = vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === "markdown" && document.uri.scheme === "file") {
                updateWebview();
            }
        });
        panel.onDidDispose(() => {
            // When the panel is closed, cancel any future updates to the webview content
            listener.dispose();
        }, null, context.subscriptions);
    }));
    // Create Header
    let createHeaderCommand = vscode.commands.registerCommand('markdownhelper.createHeader', () => __awaiter(this, void 0, void 0, function* () {
        var _c, _d;
        var path = require("path");
        let openTabFilePath = (_c = vscode.window.activeTextEditor) === null || _c === void 0 ? void 0 : _c.document.fileName;
        let fileObject = path.parse(openTabFilePath); // create fileObject from path
        let title = fileObject.name; // get name of file (also: root, dir, base, ext, name)
        title = yield getTitle(title);
        let author = yield getAuthors();
        let date = new Date().toDateString();
        // const pickedArgs = await pickPandocArgs();
        // let user choose what the desired output will be (html, pdf, beamer, revealjs)
        let formats = ["html", "pdf", "beamer", "revealjs"];
        let chosenFormat = yield pickString(formats);
        if (chosenFormat == "" || !chosenFormat) {
            return;
        }
        let header = new vscode.SnippetString(yield createFullHeader(title, author, date, chosenFormat));
        (_d = vscode.window.activeTextEditor) === null || _d === void 0 ? void 0 : _d.insertSnippet(header, new vscode.Position(0, 0));
    }));
    let buildFileCommand = vscode.commands.registerCommand('markdownhelper.buildFile', () => __awaiter(this, void 0, void 0, function* () {
        var _e, _f;
        const fs = require('fs');
        let filePath = (_e = vscode.window.activeTextEditor) === null || _e === void 0 ? void 0 : _e.document.fileName;
        if (!filePath) {
            vscode.window.showErrorMessage("Could not find Filename");
            return;
        }
        let settings = vscode.workspace.getConfiguration('markdownhelper');
        // Safe File if desired
        if (settings['autosafe-on-build']) {
            (_f = vscode.window.activeTextEditor) === null || _f === void 0 ? void 0 : _f.document.save();
        }
        // get info of yaml header
        const path = require("path");
        // read file
        let fileContents = fs.readFileSync(filePath, 'utf8');
        let data = getYamlHeaderData(fileContents);
        let pandocArgs = yield parseYamlHeader(data);
        console.log(pandocArgs);
        const callback = (error, result) => {
            if (error) {
                console.error("Error: " + error);
                return;
            }
            console.log("Executed with args:\n" + pandocArgs.toString());
            mhlog.appendLine("Executed with args:\n" + pandocArgs.toString());
            return /*console.log("result: " + result),*/ result;
        };
        executePandoc(filePath, pandocArgs, callback);
        // ALTE IMPLEMENTIERUNG
        // let argsConcat = "";
        // if (pandocArgs.length > 0) {
        // 	argsConcat += pandocArgs[0];
        // }
        // if (pandocArgs.length > 1) {
        // 	for (var i = 1; i < pandocArgs.length; i++)
        // 		argsConcat += " " + pandocArgs[i];
        // }
        // let commandString = "pandoc '" + filePath + "'" + argsConcat + " -o '" + outputPath +"'";
        // vscode.window.showInformationMessage(commandString);
        // let terminal = vscode.window.createTerminal();
        // terminal.sendText(commandString);
        // // terminal.dispose();
    }));
    context.subscriptions.push(startLiveFileViewCommand);
    context.subscriptions.push(startLiveEditorViewCommand);
    context.subscriptions.push(createHeaderCommand);
    context.subscriptions.push(buildFileCommand);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
// own input functions
function getTitle(title) {
    return __awaiter(this, void 0, void 0, function* () {
        let ret = "";
        ret += yield vscode.window.showInputBox({
            value: title,
            placeHolder: 'Title'
        });
        return ret.toString();
    });
}
exports.getTitle = getTitle;
function getAuthors() {
    return __awaiter(this, void 0, void 0, function* () {
        let author = "";
        author += yield vscode.window.showInputBox({
            value: '',
            placeHolder: 'Author(s)',
        });
        return author.toString();
    });
}
exports.getAuthors = getAuthors;
function createFullHeader(title, author, date, format) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const path = require("path");
        let outputFileExtension;
        let filename = path.parse((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.fileName).name;
        let settings = vscode.workspace.getConfiguration('markdownhelper');
        switch (format) {
            case "pdf":
            case "beamer":
                outputFileExtension = "pdf";
                break;
            case "html":
            case "revealjs":
                outputFileExtension = "html";
                break;
            default:
                break;
        }
        let cssFile = "null";
        if (format == "html" || format == "beamer") {
            // ask if including css file
            let includeCSS = yield vscode.window.showQuickPick(["Default", "No", "Yes"], {
                title: "Include CSS-File?"
            });
            if (includeCSS == "Yes") {
                yield vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: 'Open',
                    filters: {
                        'Style files': ['css'],
                        'Include files': ['html'],
                        'All files': ['*']
                    }
                }).then(fileUri => {
                    if (fileUri && fileUri[0]) {
                        cssFile = fileUri[0].fsPath;
                    }
                });
            }
            else if (includeCSS == "Default") {
                cssFile = settings["default-css"];
            }
        }
        let header = `---
title: ${title}
author: ${author}
date: ${date}
output:
  - variant: ${format}
    output-path: .${path.sep}${filename}Out.${outputFileExtension}
    from: markdown+${settings["default-extensions"]}
    to: ${format}
    pdf-engine: ${settings["default-pdf-engine"]}
    standalone: ${settings["default-standalone"]}
    self-contained: ${settings["default-self-contained"]}
    toc: ${settings["default-toc"]}
    toc-depth: ${settings["default-toc-depth"]}
    toc-title: ${settings["default-toc-title"]}
    number-sections: ${settings["default-number-sections"]}
    css: ${cssFile}
    template: ${settings["default-template"]}
    pandoc-args: []
---\n\n`;
        // header = ("---\ntitle: " + title + "\n" +
        // "author: " + author + "\n" +
        // "date: " + date + "\n" +
        // "output:\n" +
        // "  - variant: " + format + "\n" +
        // "    output-path: ." + seperator + filename + "Out." + outputFileExtension + "\n" +
        // "    to: " + format + "\n" +
        // "    pdf-engine: " + settings["default-pdf-engine"] + "\n" + 
        // "    standalone: " + settings["default-standalone"] + "\n" +
        // "    self-contained: " + settings["default-self-contained"] + "\n" +
        // "    toc: " + settings["default-toc"] + "\n" +
        // "    toc-depth: " + settings["default-toc-depth"] + "\n" +
        // "    toc-title: " + settings["default-toc-title"] + "\n" +
        // "    number-sections: " + settings["default-number-sections"] + "\n");
        // "    pandoc-extensions: [\"hard_line_break\"]\n" + 
        // "    pandoc-args: " + "[]" + "\n"
        // );
        return header;
    });
}
exports.createFullHeader = createFullHeader;
function getYamlHeaderData(fileContents) {
    var _a;
    const yaml = require('js-yaml');
    const path = require("path");
    // remove comments
    let regex = /<!--(.)*?-->/s;
    // add s for including new line to dot; adding ? after * for making it non greedy (only next occur) of -->
    while (fileContents.search("<!--") != -1)
        fileContents = fileContents.replace(regex, '');
    // split header
    let fileParts = fileContents.split("---");
    let filename = path.parse((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.fileName).name;
    let yamlHeader = "title: " + filename + "\n" +
        "output:\n" +
        "  - variant: pdf\n" +
        "    output-path: ." + path.sep + filename + "Out.html\n" +
        "    standalone: true\n" +
        "    pandoc-args: []\n";
    if (fileParts.length < 3 || fileParts[0] != "") {
        vscode.window.showWarningMessage("No correct YAML Header found. Defaulting important information...");
    }
    else {
        // extract yaml Header
        yamlHeader = fileParts[1];
    }
    console.log(yamlHeader);
    // parse header into object
    let data = yaml.load(yamlHeader);
    // console.log("header: \n")
    // console.log(data);
    // console.log("-----");
    return data;
}
exports.getYamlHeaderData = getYamlHeaderData;
function parseYamlHeader(data, buildIntoFile = true) {
    return __awaiter(this, void 0, void 0, function* () {
        let selectedOutput;
        let outputPath;
        let pandocArgs = [];
        // variablen bestimmen (alle zusätzlichen zu title author date)
        if (data.output == undefined) {
            outputPath = "./out.pdf";
            console.log("Output undefined, defaulting to no args and -o=" + outputPath);
        }
        else {
            let outputLen = data.output.length;
            if (outputLen < 1) {
                // no output set -> default (html)
                outputPath = "./out.html";
                console.log("no output variant set, defaulting to no args and -o=" + outputPath);
            }
            else {
                // take it
                selectedOutput = data.output[0];
                if (outputLen > 1 && buildIntoFile) {
                    let outputStrings = [outputLen];
                    for (var i = 0; i < outputLen; i++) {
                        outputStrings[i] = data.output[i].variant;
                    }
                    let pickedOutputString = yield pickString(outputStrings);
                    for (var i = 0; i < outputLen; i++) {
                        if (data.output[i].variant == pickedOutputString) {
                            selectedOutput = data.output[i];
                            break;
                        }
                    }
                }
                outputPath = selectedOutput["output-path"] ? selectedOutput["output-path"] : "./out.html";
                pandocArgs = selectedOutput["pandoc-args"] ? selectedOutput["pandoc-args"] : [];
            }
        }
        // pandocArgs.push("--from=markdown");
        if (buildIntoFile) {
            pandocArgs.push("-o");
            pandocArgs.push(outputPath);
        }
        // read additional arguments
        if (data.output != undefined) {
            if (selectedOutput["from"] != undefined) {
                pandocArgs.push("--from");
                pandocArgs.push(selectedOutput["from"]);
            }
            if (selectedOutput["to"] != undefined) {
                pandocArgs.push("--to");
                pandocArgs.push(buildIntoFile ? selectedOutput["to"] : "html");
            }
            if (selectedOutput["standalone"]) {
                pandocArgs.push("-s");
            }
            if (selectedOutput["self-contained"]) {
                pandocArgs.push("--self-contained");
            }
            if (selectedOutput.toc) {
                pandocArgs.push("--toc");
                let tocDepth = selectedOutput["toc-depth"];
                if (tocDepth > 0 && tocDepth <= 7) {
                    pandocArgs.push("--toc-depth");
                    pandocArgs.push(tocDepth);
                }
            }
            if (selectedOutput["number-sections"])
                pandocArgs.push("--number-sections");
            let pdfEngine = selectedOutput["pdf-engine"];
            if (pdfEngine != undefined) {
                pandocArgs.push("--pdf-engine");
                pandocArgs.push(pdfEngine);
            }
            if (selectedOutput["css"] != undefined) {
                pandocArgs.push("--css");
                pandocArgs.push(selectedOutput["css"]);
            }
            if (selectedOutput["template"] != undefined) {
                pandocArgs.push("--template");
                pandocArgs.push(selectedOutput["template"]);
            }
            // variables
            // titel und athor selber übergeben
            if (selectedOutput["toc-title"]) {
                pandocArgs.push("--variable");
                if (selectedOutput["toc-title"]) {
                    pandocArgs.push("toc-title=" + selectedOutput["toc-title"]);
                }
            }
            // metadata
            pandocArgs.push("--metadata");
            if (data.title != undefined) {
                pandocArgs.push("title=" + data["title"]);
            }
        }
        return pandocArgs;
    });
}
exports.parseYamlHeader = parseYamlHeader;
function executePandoc(filePath, pandocArgs, callback) {
    const path = require("path");
    const nodePandoc = require("node-pandoc");
    // make pandoc execute in the right folder
    process.chdir(path.dirname(filePath));
    // pandoc befehl
    nodePandoc(filePath, pandocArgs, callback);
    return "";
}
exports.executePandoc = executePandoc;
function executePandocRawData(data, pandocArgs, callback) {
    const nodePandoc = require("node-pandoc");
    // pandoc befehl
    nodePandoc(data, pandocArgs, callback);
    return "";
}
exports.executePandocRawData = executePandocRawData;
function pickString(items) {
    return __awaiter(this, void 0, void 0, function* () {
        let pick = "";
        pick += yield vscode.window.showQuickPick(items);
        return pick;
    });
}
exports.pickString = pickString;
// Old stuff
// later
// if (format == "html") {
// 	header += (
// 		"# Arguments for html output:\n" + 
// 		"document-css: style.css\n" +
// 		"mainfont: roboto\n" +
// 		"fontsize: 12pt\n" +
// 		"fontcolor: 1a1a1a\n" +
// 		"# linkcolor\n" +
// 		"# monofont\n" +
// 		"# monobackgroundcolor\n" +
// 		"# linestretch\n" +
// 		"# backgroundcolor\n" +
// 		"# margin-left, margin-right, margin-top, margin-bottom\n"				
// 	);
// }
// export function createHeader(title:string, author:string, date:string, setperator:string, items:vscode.QuickPickItem[]) {
// 	const path = require("path");
// 	let header = ("---\ntitle: "+ title +"\n" +
// 			"author: " + author + "\n" +
// 			"date: " + date + "\n" +
// 			"output:\n" +
// 			"    - variant: pdf\n" +
// 			"      output-path: ."+ setperator +"out.pdf\n" +
// 			"      pandoc-args: []\n"
// 			// "\t\t\ttoc: true\n" +
// 			);
// 	items.forEach(item => {
// 		switch (item.label) {
// 			case 'TOC':
// 				header += "\t\t\ttoc: true\n";
// 				header += "\t\t\ttoc-depth: 2\n";
// 				break;		
// 			default:
// 				break;
// 		}
// 	}); {
// 	}
// 	header += "---\n\n";
// 	return header;
// }
// export async function pickPandocArgs() : Promise<vscode.QuickPickItem[]> {
// 	const items : vscode.QuickPickItem[] = [
// 		{label: 'TOC', description: 'eine beschreibung'},
// 		{label: 'Number Sections', detail: 'ein kleines detil'},
// 		{label: 'Specify output format'},
// 		{label: 'Hard Line Breaks'},
// 		{label: 'emoji'},
// 		// {label: 'Custom CSS'}
// 		// which output format???
// 		// pdf, html, beamer, js-slide shows
// 	];
// 	let result = await vscode.window.showQuickPick(items, {
// 		placeHolder: 'eins, zwei or drei',
// 		title: "Pick desired pandoc settings",
// 		canPickMany: true
// 	});
// 	if (!result) {
// 		result = [];
// 	}
// 	return result;
// 	// const prom = new Promise<vscode.QuickPickItem[]>((resolve, reject) => {
// 	// 	resolve(result);
// 	// });	
// 	// return prom;
// }
//# sourceMappingURL=extension.js.map