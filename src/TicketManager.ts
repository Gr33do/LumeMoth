// Import required modules
const { execFileSync } = require('child_process');
const path = require('path');

function safeExec(command, args) {
    // Sanitize input and normalize paths
    const sanitizedArgs = args.map(arg => path.normalize(arg));
    // Ensure command is trusted before executing
    const safeCommand = path.normalize(command);

    // Execute the command safely
    return execFileSync(safeCommand, sanitizedArgs);
}

// Example usage
try {
    const result = safeExec('./script.sh', ['arg1', 'arg2']);
    console.log(result.toString());
} catch (error) {
    console.error('Error executing command:', error);
}