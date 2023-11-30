import * as vscode from
 
'vscode';

export
 
class
 
IntelligentTypes
 
implements
 
vscode.CodeActionProvider
 
{
  constructor(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('types-installer.installTypesModule', async (range: vscode.Range) => {
      // Save the active text editor document before proceeding
      vscode.window.activeTextEditor?.document.save();

      // Get the selected text from the active text editor
      const text = vscode.window.activeTextEditor?.document.getText(range);

      // Determine whether to use yarn or npm based on the presence of a yarn.lock file
      const useYarn = !!(await vscode.workspace.findFiles('yarn.lock'));

      // Construct the appropriate shell command for installing the types
      const shellExec = useYarn
        ? new vscode.ShellExecution(`yarn add --dev @types/${text}`)
        : new vscode.ShellExecution(`npm i --save-dev @types/${text}`);

      // Define a task for executing the shell command
      const task = new vscode.Task({ type: 'IntelligentTypes' }, vscode.TaskScope.Workspace, 'IntelligentTypes', 'Types Installer', shellExec, 'npm');

      // Execute the task to install the types
      vscode.tasks.executeTask(task);
    });

    context.subscriptions.push(command);
  }

  provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    // Filter out diagnostics that don't match the 'no-types-detected' code
    const relevantDiagnostics = context.diagnostics.filter(diagnostic => diagnostic.code === 'no-types-detected');

    // Create code action commands for each relevant diagnostic
    const codeActions = relevantDiagnostics.map(diagnostic => this.createCommandCodeAction(diagnostic));

    return codeActions;
  }

  private createCommandCodeAction(diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const text = vscode.window.activeTextEditor?.document.getText(diagnostic.range);
    const action = new vscode.CodeAction(`Install @types/${text} module...`, vscode.CodeActionKind.QuickFix);

    // Associate the code action with the diagnostic
    action.diagnostics = [diagnostic];

    // Mark the code action as preferred
    action.isPreferred = true;

    // Define the command for executing the code action
    action.command = {
      command: 'types-installer.installTypesModule',
      title: 'Install @types Module',
      tooltip: `Installs the '@types/${text}' module to resolve missing type definitions.`,
      arguments: [diagnostic.range],
    };

    return action;
  }
}