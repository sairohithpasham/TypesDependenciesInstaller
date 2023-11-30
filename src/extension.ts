import * as vscode from 'vscode';
import { IntelligentTypes } from './typesInstaller';

interface ProjectPackage {
    name: string;
    types?: string;
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
}

async function shouldFlagAsTypeInstallationNeeded(nodeModulePath: vscode.Uri, projectPackage: ProjectPackage, targetPackage: string): Promise<boolean> {
    const possibleTypesPackageName = `@types/${targetPackage}`;

    if (projectPackage.devDependencies?.[possibleTypesPackageName]) {
        return false;
    }

    try {
        const nodeModulePackageJson: ProjectPackage = require(nodeModulePath.fsPath);
        if (nodeModulePackageJson.types) {
            return false;
        }
    } catch {
        // Ignore errors
    }

    const files = await vscode.workspace.findFiles(`node_modules/${targetPackage}/index.d.ts`);
    return !files.length;
}

async function analyzePackageJsonForTypes(doc: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    const text = doc.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    let projectPackage: ProjectPackage;
    try {
        projectPackage = JSON.parse(text);
    } catch {
        return diagnostics;
    }

    const textLines: string[] = text.split(/\r\n|\n/);
    const indexFirstDependency = textLines.findIndex((line: string) => /\s*"dependencies"/.test(line)) + 1;

    if (indexFirstDependency !== -1) {
        let lineIndex = indexFirstDependency;

        while (lineIndex < textLines.length && !/\s*}/.test(textLines[lineIndex])) {
            const match = /\s*"(.*)"\s*:/.exec(textLines[lineIndex]);

            if (match) {
                const packageName = match[1];
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
                const nodeModulePath = vscode.Uri.joinPath(workspaceFolder!.uri, 'node_modules', packageName);

                const typesPackageName = `@types/${packageName}`;
                if (await shouldFlagAsTypeInstallationNeeded(nodeModulePath, projectPackage, packageName)) {
                    const startPosition = textLines[lineIndex].indexOf(packageName);
                    const endPosition = startPosition + packageName.length;

                    diagnostics.push({
                        severity: vscode.DiagnosticSeverity.Information,
                        message: `No "types" property detected in package.json. Install a types package like '${typesPackageName}' for TypeScript compatibility.`,
                        code: 'no-types-detected',
                        source: 'Types Installer Helper',
                        range: new vscode.Range(lineIndex, startPosition, lineIndex, endPosition)
                    });
                }
            }
            lineIndex++;
        }
    }

    return diagnostics;
}

export async function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('types-installer');
    
    const handleDocumentAnalysis = async (doc: vscode.TextDocument) => {
        if (doc.fileName.endsWith('package.json')) {
            const diagnostics = await analyzePackageJsonForTypes(doc);
            diagnosticCollection.set(doc.uri, diagnostics);
        }
    };
    
    const didOpen = vscode.workspace.onDidOpenTextDocument(handleDocumentAnalysis);
    const didChange = vscode.workspace.onDidChangeTextDocument(e => handleDocumentAnalysis(e.document));
    const codeActionProvider = vscode.languages.registerCodeActionsProvider('json', new IntelligentTypes(context));
    
    if (vscode.window.activeTextEditor) {
        await handleDocumentAnalysis(vscode.window.activeTextEditor.document);
    }
    
    context.subscriptions.push(
        diagnosticCollection,
        didOpen,
        didChange,
        codeActionProvider
    );
}

export function deactivate() {}
