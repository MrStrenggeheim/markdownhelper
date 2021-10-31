import * as vscode from 'vscode';


// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Markdownhelper is now active!');

	// Create Header
	let createHeaderCommand = vscode.commands.registerCommand('markdownhelper.createHeader', async () => {
		var path = require("path");
		
		let openTabFilePath = vscode.window.activeTextEditor?.document.fileName;
		let fileObject = path.parse(openTabFilePath); // create fileObject from path
		let title = fileObject.name; // get name of file (also: root, dir, base, ext, name)
		
		title = await getTitle(title);
		let author = await getAuthors();
		let date = new Date().toDateString();
		
		// const pickedArgs = await pickPandocArgs();

		// let user choose what the desired output will be (html, pdf, beamer, revealjs)
		let formats = ["html", "pdf", "beamer", "revealjs"];
		let chosenFormat = await pickString(formats);

		let header = new vscode.SnippetString(await createFullHeader(title, author, date, path.sep, chosenFormat));

		// console.log(pickedArgs);
		
		vscode.window.activeTextEditor?.insertSnippet(header, new vscode.Position(0, 0));
	});

	let buildFileCommand = vscode.commands.registerCommand('markdownhelper.buildFile', async () => {
		let file = vscode.window.activeTextEditor?.document;
		let filePath = file?.fileName;

		// TODO : extract information from yaml header 
		// read-all.js
		const fs = require('fs');
		const yaml = require('js-yaml');
		const nodePandoc = require("node-pandoc");
		const path = require("path");

		// read file
		let fileContents = fs.readFileSync(filePath, 'utf8');
		// remove comments
		let regex = /<!--(.)*?-->/s;
		// add s for including new line to dot; adding ? after * for making it non greedy (only next occur) of -->
		while (fileContents.search("<!--") != -1)
			fileContents = fileContents.replace(regex,'');
		// split header
		let fileParts = fileContents.split("---");
		
		
		let filename = path.parse(vscode.window.activeTextEditor?.document.fileName).name;
		let yamlHeader =
		"title: "+ filename +"\n" +
		"output:\n" +
		"  - variant: pdf\n" +
		"    output-path: ."+ path.sep + filename +"Out.html\n" +
		"    standalone: true\n" +
		"    pandoc-args: []\n";

		console.log(fileParts[0] == "");
		if (fileParts.length < 3 || fileParts[0] != "") {
			vscode.window.showWarningMessage("No correct YAML Header found. Defaulting important information...");
		} else {
			// extract yaml Header
			yamlHeader = fileParts[1];
		}

		// parse header into object
		let data = yaml.load(yamlHeader);
		console.log(data);
		
		let outputPath;
		let pandocArgs;
		
		let selectedOutput;

		// variablen bestimmen (alle zusätzlichen zu title author date)
		if (data.output == undefined) {
			console.log("output undefined")
			outputPath = "./out.pdf"
			pandocArgs = [];
		} else {
			let outputLen = data.output.length;
			if (outputLen < 1) {
				// no output set -> default (html)
				outputPath = "./out.html";
				pandocArgs = [];
			} else {
				// take it
				selectedOutput = data.output[0];

				if (outputLen > 1) {
					let outputStrings = [outputLen];
					for (var i = 0; i < outputLen; i++) {
						outputStrings[i] = data.output[i].variant;
					}
					let pickedOutputString = await pickString(outputStrings);
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
		
		const callback = (error: any, result: any) => {
			if (error) console.error("Error: " + error);
			vscode.window.showInformationMessage("Done");
			return console.log("result: " + result), result
		}

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
				pandocArgs.push("--self-contained")
			}

			// variables
			// titel und athor selber übergeben
			if (selectedOutput["toc-title"]) {
				pandocArgs.push("--variable")
				if (selectedOutput["toc-title"]) {
					pandocArgs.push("toc-title="+selectedOutput["toc-title"]);
				}
			}

			// metadata
			pandocArgs.push("--metadata");
			if (data.title != undefined) {
				pandocArgs.push("title="+data["title"]);
			}
		}
		console.log(pandocArgs);
	
		// make pandoc execute in the right folder
		process.chdir(path.dirname(filePath));
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
	});


	context.subscriptions.push(createHeaderCommand);
	context.subscriptions.push(buildFileCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}



// own input functions
export async function getTitle(title: string) : Promise<string> {
	let ret = "";
	ret += await vscode.window.showInputBox({
		value: title,
		// valueSelection: [0,0],
		placeHolder: 'Title',
		// validateInput: text => {
		// 	vscode.window.showInformationMessage(`Validating: ${text}`);
		// 	return text === '123' ? 'Not 123!' : null;
		// }
	});
	return ret.toString();
}

export async function getAuthors() : Promise<string> {
	let author = "";
	author += await vscode.window.showInputBox({
		value: '',
		placeHolder: 'Author(s)',
	});
	return author.toString();
}

export async function createFullHeader(title:string, author:string, date:string, seperator:string, format:string) {
	const path = require("path");
	let outputFileExtension;
	let filename = path.parse(vscode.window.activeTextEditor?.document.fileName).name;
	
	switch (format) {
		case "pdf": case "beamer":
			outputFileExtension = "pdf";
			break;
		case "html": case "revealjs":
			outputFileExtension = "html";
			break;
		default:
			break;
	}

	let header = ("---\ntitle: "+ title +"\n" +
		"author: " + author + "\n" +
		"date: " + date + "\n" +
		"output:\n" +
		"  - variant: "+ format +"\n" +
		"    output-path: ."+ seperator + filename + "Out."+ outputFileExtension +"\n" +
		"    to: "+ format +"\n" +
		"    standalone: true\n" +
		"    toc: true\n" +
		"    toc-depth: 2\n" + 
		"    toc-title: Contents\n" +
		"    number-sections: true\n"
	);


	if (format == "html") {
		// ask if including css file
		let includeCSS = await vscode.window.showQuickPick(["No", "Yes"], {
			title: "Include CSS-File?"
		}
		);
		if (includeCSS == "Yes") {
			await vscode.window.showOpenDialog({
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
		}
	}

	header += (
		"    pandoc-args: " + "[]" + "\n"
	);

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
}
	

export function createHeader(title:string, author:string, date:string, setperator:string, items:vscode.QuickPickItem[]) {
	const path = require("path");
	let header = ("---\ntitle: "+ title +"\n" +
			"author: " + author + "\n" +
			"date: " + date + "\n" +
			"output:\n" +
			"    - variant: pdf\n" +
			"      output-path: ."+ setperator +"out.pdf\n" +
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
	}); {

	}
	header += "---\n\n";
	return header;
}

export async function pickString(items:string[]) : Promise<string> {
	let pick = "";
	pick += await vscode.window.showQuickPick(items);
	return pick;
}

export async function pickPandocArgs() : Promise<vscode.QuickPickItem[]> {
	const items : vscode.QuickPickItem[] = [
		{label: 'TOC', description: 'eine beschreibung'},
		{label: 'Number Sections', detail: 'ein kleines detil'},
		{label: 'Hard Line Breaks'},
		{label: 'Specify output format'}
		// {label: 'emoji'},
		// {label: 'Custom CSS'}
		// which output format???
		// pdf, html, beamer, js-slide shows
	];

	let result = await vscode.window.showQuickPick(items, {
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

}