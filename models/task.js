// Load required packages
var mongoose = require('mongoose');

// Define our user schema
var TaskSchema = new mongoose.Schema({
    name: {type: String, required: [true, "name is required"]},
    description: {type: String},
    deadline: {type: Date, required: [true, "deadline is required"]},
    completed: {type: Boolean, default: false } ,
    assignedUser: {type: String, default: ''},
    assignedUserName: {type: String, default: 'unassigned'},
    dateCreated: {type: Date, default: Date.now}
});

// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
