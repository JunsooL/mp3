const Task = require('../models/task');
const User = require('../models/user');

module.exports = function(router) {
    //TASKS
    const taskRoute = router.route("/tasks");
    
    //GET
    taskRoute.get(async function(req, res) {
        try {
            let query = Task.find();
            
            //WHERE param
            if (req.query.where) {
                try {
                    query = query.where(JSON.parse(req.query.where));
                } catch (e) {
                    return res.status(400).json({ 
                        message: 'Invalid where parameter', 
                        data: {} 
                    });
                }
            }

            //SORT param
            if (req.query.sort) {
                try {
                    query = query.sort(JSON.parse(req.query.sort));
                } catch (e) {
                    return res.status(400).json({ 
                        message: 'Invalid sort parameter', 
                        data: {} 
                    });
                }
            }

            //SELECT param
            if (req.query.select) {
                try {
                    query = query.select(JSON.parse(req.query.select));
                } catch (e) {
                    return res.status(400).json({ 
                        message: 'Invalid select parameter', 
                        data: {} 
                    });
                }
            }

            //SKIP param
            if (req.query.skip) {
                query = query.skip(parseInt(req.query.skip));
            }

            //LIMIT param
            if (req.query.limit) {
                query = query.limit(parseInt(req.query.limit) || 100);
            } else {
                query = query.limit(100); // Default limit for tasks
            }

            //COUNT param
            if (req.query.count === 'true') {
                const count = await Task.countDocuments(
                    req.query.where ? JSON.parse(req.query.where) : {}
                );
                return res.status(200).json({
                    message: "OK",
                    data: count
                });
            }


            //JSON response
            const result = await query.exec();
            
            res.status(200).json({
                message: "OK",
                data: result
            });
        } catch (err) {
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    // POST
    taskRoute.post(async function(req, res) {
        try {
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({
                    message: 'Task name and deadline are required',
                    data: {}
                });
            }

            const newTask = new Task({
                name: req.body.name,
                description: req.body.description || '',
                deadline: req.body.deadline,
                completed: req.body.completed || false,
                assignedUser: req.body.assignedUser || '',
                assignedUserName: req.body.assignedUserName || 'unassigned'
            });
            
            //personal note: both create and save work here and create should be favored just for performance
            const savedTask = await newTask.save();
            
            // FIX: Update user's pendingTasks if task is assigned and not completed
            if (savedTask.assignedUser && savedTask.assignedUser !== '' && !savedTask.completed) {
                await User.findByIdAndUpdate(
                    savedTask.assignedUser,
                    { $addToSet: { pendingTasks: savedTask._id.toString() } }
                );
            }

            res.status(201).json({
                message: "Task created successfully",
                data: savedTask
            });
        } catch(err) {
            if (err.name === 'ValidationError') {
                return res.status(400).json({ 
                    message: 'Validation failed',
                    data: {} 
                });
            }
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    //TASK IDS
    const taskIdRoute = router.route("/tasks/:id");
    
    //GET
    taskIdRoute.get(async function(req, res) {
        try {
            let query = Task.findById(req.params.id);
            
            //SELECT param
            if (req.query.select) {
                try {
                    query = query.select(JSON.parse(req.query.select));
                } catch (e) {
                    return res.status(400).json({ 
                        message: 'Invalid select parameter', 
                        data: {} 
                    });
                }
            }
            

            //JSON response
            const task = await query.exec();
            
            if (!task) {
                return res.status(404).json({ 
                    message: 'Task not found',
                    data: {} 
                });
            }
            
            res.status(200).json({
                message: "OK",
                data: task
            });
        } catch(err) {
            if (err.name === 'CastError') {
                return res.status(404).json({ 
                    message: 'Task not found',
                    data: {} 
                });
            }
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    // PUT
    taskIdRoute.put(async function(req, res) {
        try {
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({
                    message: 'Task name and deadline are required',
                    data: {}
                });
            }

            const oldTask = await Task.findById(req.params.id);
            if (!oldTask) {
                return res.status(404).json({ 
                    message: 'Task not found',
                    data: {} 
                });
            }

            const oldAssignedUser = oldTask.assignedUser;
            const newAssignedUser = req.body.assignedUser || '';

            const updatedTask = await Task.findByIdAndUpdate(
                req.params.id,
                {
                    name: req.body.name,
                    description: req.body.description || '',
                    deadline: req.body.deadline,
                    completed: req.body.completed || false,
                    assignedUser: newAssignedUser,
                    assignedUserName: req.body.assignedUserName || 'unassigned'
                },
                { 
                    new: true,
                    runValidators: true,
                    overwrite: true
                }
            );

            // Handle two-way, check for existing user from task and reassign
            if (oldAssignedUser && oldAssignedUser !== '') {
                await User.findByIdAndUpdate(
                    oldAssignedUser,
                    { $pull: { pendingTasks: req.params.id } }
                );
            }

            if (newAssignedUser && newAssignedUser !== '' && newAssignedUser !== oldAssignedUser) {
                await User.findByIdAndUpdate(
                    newAssignedUser,
                    { $addToSet: { pendingTasks: req.params.id } }
                );
            }

            //JSON RESPONSE

            res.status(200).json({
                message: "Task updated successfully",
                data: updatedTask
            });
        } catch(err) {
            //CASE: name must be unique
            if (err.code === 11000) {
                return res.status(400).json({ 
                    message: 'Task with that name already exists',
                    data: {} 
                });
            }

            //CASE: bad request
            if (err.name === 'ValidationError') {
                return res.status(400).json({ 
                    message: 'Bad Request',
                    data: {} 
                });
            }
            if (err.name === 'CastError') {
                return res.status(404).json({ 
                    message: 'Task not found',
                    data: {} 
                });
            }
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    // DELETE
    taskIdRoute.delete(async function(req, res) {
        try {
            const deletedTask = await Task.findByIdAndDelete(req.params.id);
            
            if (!deletedTask) {
                return res.status(404).json({ 
                    message: 'Task not found',
                    data: {} 
                });
            }

            if (deletedTask.assignedUser && deletedTask.assignedUser !== '') {
                await User.findByIdAndUpdate(
                    deletedTask.assignedUser,
                    { $pull: { pendingTasks: req.params.id } }
                );
            }
            
            res.status(200).json({ 
                message: 'Task deleted successfully',
                data: deletedTask
            });
        } catch(err) {
            if (err.name === 'CastError') {
                return res.status(404).json({ 
                    message: 'Task not found',
                    data: {} 
                });
            }
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    return router;
}