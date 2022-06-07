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
exports.pickPandocArgs = exports.pickString = exports.createHeader = exports.createFullHeader = exports.getAuthors = exports.getTitle = exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
// this method is called when your extension is activated
function activate(context) {
    console.log('Markdownhelper is now active!');
    // Create Header
    let createHeaderCommand = vscode.commands.registerCommand('markdownhelper.createHeader', () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        var path = require("path");
        let openTabFilePath = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.fileName;
        let fileObject = path.parse(openTabFilePath); // create fileObject from path
        let title = fileObject.name; // get name of file (also: root, dir, base, ext, name)
        title = yield getTitle(title);
        let author = yield getAuthors();
        let date = new Date().toDateString();
        // const pickedArgs = await pickPandocArgs();
        // let user choose what the desired output will be (html, pdf, beamer, revealjs)
        let formats = ["html", "pdf", "beamer", "revealjs"];
        let chosenFormat = yield pickString(formats);
        let header = new vscode.SnippetString(yield createFullHeader(title, author, date, path.sep, chosenFormat));
        // console.log(pickedArgs);
        (_b = vscode.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.insertSnippet(header, new vscode.Position(0, 0));
    }));


    let buildFileCommand = vscode.commands.registerCommand('markdownhelper.buildFile', () => __awaiter(this, void 0, void 0, function* () {
        var _c, _d;
        let file = (_c = vscode.window.activeTextEditor) === null || _c === void 0 ? void 0 : _c.document;
        let filePath = file === null || file === void 0 ? void 0 : file.fileName;
        // read-all.js
        const fs = require('fs');
        const yaml = require('js-yaml');
        const nodePandoc = require("node-pandoc");
        const path = require("path");
        // read file
        let fileContents = fs.readFileSync(filePath, 'utf8');
        // remove comments
        let regex = /<!--(.)*?-->/s;
        // add s for including new line to dot; 
        // adding ? after * for making it non greedy (only next occur) of -->
        while (fileContents.search("<!--") != -1)
            fileContents = fileContents.replace(regex, '');
        // split header
        let fileParts = fileContents.split("---");
        let filename = path.parse((_d = vscode.window.activeTextEditor) === null || _d === void 0 ? void 0 : _d.document.fileName).name;
        let yamlHeader = "title: " + filename + "\n" +
            "output:\n" +
            "  - variant: pdf\n" +
            "    output-path: ." + path.sep + filename + "Out.html\n" +
            "    standalone: true\n" +
            "    pandoc-args: []\n";
        // console.log(fileParts[0] == "");
        if (fileParts.length < 3 || fileParts[0] != "") {
            vscode.window.showWarningMessage("No correct YAML Header found. Defaulting important information...");
        }
        else {
            // extract yaml Header
            yamlHeader = fileParts[1];
        }
        // parse header into object
        let data = yaml.load(yamlHeader);
        console.log("header: \n")
        console.log(data);
        let outputPath;
        let pandocArgs = [];
        let selectedOutput;
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
                if (outputLen > 1) {
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

        // load settings
        // console.log(vscode.workspace.getConfiguration('markdownhelper'));
        
        // pandocArgs.push("--from=markdown");
        pandocArgs.push("-o");
        pandocArgs.push(outputPath);
        // read additional arguments
        if (data.output != undefined) {
            if (selectedOutput["to"] != undefined) {
                pandocArgs.push("--to");
                pandocArgs.push(selectedOutput["to"]);
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
        console.log(pandocArgs);
        // make pandoc execute in the right folder
        process.chdir(path.dirname(filePath));

        const callback = (error, result) => {
            if (error)
                console.error("Error: " + error);
            vscode.window.showInformationMessage("Executed with args:\n" + pandocArgs);
            return console.log("result: " + result), result;
        };
        // pandoc befehl
        nodePandoc(filePath, pandocArgs, callback);
        // if (data.output[0].toc_depth != undefined) {
        // 	// mach was wenn toc_depth einen ewrt hat oder halt iwi gesetzt wurde
        // }
        // funktioniert: ['-o','C:\\Users\\Florian\\Dokumente\\VSCode Extension\\MarkdownHelper\\testFolder\\out.pdf']
        // vscode.window.showInformationMessage(pandocArgs);
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

    let addVariantCommand = vscode.commands.registerCommand('markdownhelper.addVariant', () => __awaiter(this, void 0, void 0, function* () {
        vscode.window.showInformationMessage("not yet implemented");
    }));
    context.subscriptions.push(createHeaderCommand);
    context.subscriptions.push(buildFileCommand);
    context.subscriptions.push(addVariantCommand);
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
            // valueSelection: [0,0],
            placeHolder: 'Title',
            // validateInput: text => {
            // 	vscode.window.showInformationMessage(`Validating: ${text}`);
            // 	return text === '123' ? 'Not 123!' : null;
            // }
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
function createFullHeader(title, author, date, seperator, format) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const path = require("path");
        let outputFileExtension;
        let filename = path.parse((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.fileName).name;
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
        let settings = vscode.workspace.getConfiguration('markdownhelper');
        let header = ("---\ntitle: " + title + "\n" +
            "author: " + author + "\n" +
            "date: " + date + "\n" +
            "output:\n" +
            "  - variant: " + format + "\n" +
            "    output-path: ." + seperator + filename + "Out." + outputFileExtension + "\n" +
            "    to: " + format + "\n" +
            "    pdf-engine: " + settings["default-pdf-engine"] + "\n" + 
            "    standalone: " + settings["default-standalone"] + "\n" +
            "    self-contained: " + settings["default-self-contained"] + "\n" +
            "    toc: " + settings["default-toc"] + "\n" +
            "    toc-depth: " + settings["default-toc-depth"] + "\n" +
            "    toc-title: " + settings["default-toc-title"] + "\n" +
            "    number-sections: " + settings["default-number-sections"] + "\n");
        if (format == "html" || format == "beamer") {
            // ask if including css file
            let includeCSS = yield vscode.window.showQuickPick(["No", "Yes"], {
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
                        header += ("    css: " + fileUri[0].fsPath + "\n");
                    }
                });
            } else {
                header += "    css: " + settings["default-css"] + "\n";
            }
        }
        header += ("    pandoc-args: " + "[]" + "\n");
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
        header += "---\n\n";
        return header;
    });
}
exports.createFullHeader = createFullHeader;
function createHeader(title, author, date, setperator, items) {
    const path = require("path");
    let header = ("---\ntitle: " + title + "\n" +
        "author: " + author + "\n" +
        "date: " + date + "\n" +
        "output:\n" +
        "    - variant: pdf\n" +
        "      output-path: ." + setperator + "out.pdf\n" +
        "      pandoc-args: []\n"
    // "\t\t\ttoc: true\n" +
    );
    items.forEach(item => {
        switch (item.label) {
            case 'TOC':
                header += "\t\t\ttoc: true\n";
                header += "\t\t\ttoc-depth: 2\n";
                break;
            default:
                break;
        }
    });
    {
    }
    header += "---\n\n";
    return header;
}
exports.createHeader = createHeader;
function pickString(items) {
    return __awaiter(this, void 0, void 0, function* () {
        let pick = "";
        pick += yield vscode.window.showQuickPick(items);
        return pick;
    });
}
exports.pickString = pickString;
function pickPandocArgs() {
    return __awaiter(this, void 0, void 0, function* () {
        const items = [
            { label: 'TOC', description: 'eine beschreibung' },
            { label: 'Number Sections', detail: 'ein kleines detil' },
            { label: 'Hard Line Breaks' },
            { label: 'Specify output format' }
            // {label: 'emoji'},
            // {label: 'Custom CSS'}
            // which output format???
            // pdf, html, beamer, js-slide shows
        ];
        let result = yield vscode.window.showQuickPick(items, {
            // placeHolder: 'eins, zwei or drei',
            title: "Pick desired pandoc settings",
            canPickMany: true
        });
        if (!result) {
            result = [];
        }
        return result;
        // const prom = new Promise<vscode.QuickPickItem[]>((resolve, reject) => {
        // 	resolve(result);
        // });	
        // return prom;
    });
}
exports.pickPandocArgs = pickPandocArgs;
//# sourceMappingURL=extension.js.map
//test