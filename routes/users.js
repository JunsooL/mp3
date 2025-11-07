const User = require('../models/user');
const Task = require('../models/task');

module.exports = function(router) {
    //USERS
    const userRoute = router.route("/users");
    
    //GET 
    userRoute.get(async function(req, res) {
        try {
            let query = User.find();
            
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
                query = query.limit(parseInt(req.query.limit));
            }

            //COUNT param
            if (req.query.count === 'true') {
                const count = await User.countDocuments(
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
    
    //POST 
    userRoute.post(async function(req, res) {
        try {
            //CASE: email or name aren't given and user cannot sign up(in context of todolist app)
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({
                    message: 'User name and email are required',
                    data: {}
                });
            }

            const newUser = new User({
                name: req.body.name,
                email: req.body.email,
                pendingTasks: req.body.pendingTasks || []
            });
            
            //save user to DB, sometimes add __v tag for iteration, again create() should work better here technically
            const savedUser = await newUser.save();
            
            res.status(201).json({
                message: "User created successfully",
                data: savedUser
            });
        } catch(err) {
            //CASE: signing up with already existing email
            if (err.code === 11000) {
                return res.status(400).json({ 
                    message: 'User with that email already exists',
                    data: {} 
                });
            }

            //CASE: bad request
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
    
    //USERSID
    const usersIdRoute = router.route("/users/:id");
    
    //GET
    usersIdRoute.get(async function(req, res) {
        try {
            let query = User.findById(req.params.id);
            
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
            
            const user = await query.exec();
            
            if (!user) {
                return res.status(404).json({ 
                    message: 'User not found',
                    data: {} 
                });
            }
            
            res.status(200).json({
                message: "OK",
                data: user
            });
        } catch(err) {
            if (err.name === 'CastError') {
                return res.status(404).json({ 
                    message: 'User not found',
                    data: {} 
                });
            }
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    //PUT
    usersIdRoute.put(async function(req, res) {
        try {
            //CASE: username and email are required
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({
                    message: 'User name and email are required',
                    data: {}
                });
            }

            const oldUser = await User.findById(req.params.id);
            if (!oldUser) {
                return res.status(404).json({ 
                    message: 'User not found',
                    data: {} 
                });
            }

            const oldPendingTasks = oldUser.pendingTasks || [];
            const newPendingTasks = req.body.pendingTasks || [];

            // Update the user
            const updatedUser = await User.findByIdAndUpdate(
                req.params.id,
                {
                    name: req.body.name,
                    email: req.body.email,
                    pendingTasks: newPendingTasks
                },
                { 
                    new: true,
                    runValidators: true,
                    overwrite: true
                }
            );

           //two way, check for reassigning tasks to different user
            const tasksToUnassign = oldPendingTasks.filter(taskId => 
                !newPendingTasks.includes(taskId)
            );
            for (let taskId of tasksToUnassign) {
                await Task.findByIdAndUpdate(taskId, {
                    assignedUser: '',
                    assignedUserName: 'unassigned'
                });
            }

            // Assign this user to new tasks
            const tasksToAssign = newPendingTasks.filter(taskId => 
                !oldPendingTasks.includes(taskId)
            );
            for (let taskId of tasksToAssign) {
                await Task.findByIdAndUpdate(taskId, {
                    assignedUser: updatedUser._id.toString(),
                    assignedUserName: updatedUser.name
                });
            }

            res.status(200).json({
                message: "User updated successfully",
                data: updatedUser
            });
        } catch(err) {
            //CASE: already existing email and user
            if (err.code === 11000) {
                return res.status(400).json({ 
                    message: 'User with that email already exists',
                    data: {} 
                });
            }
            //CASE: bad request
            if (err.name === 'ValidationError') {
                return res.status(400).json({ 
                    message: 'Validation failed',
                    data: {} 
                });
            }
            if (err.name === 'CastError') {
                return res.status(404).json({ 
                    message: 'User not found',
                    data: {} 
                });
            }
            res.status(500).json({ 
                message: 'Internal server error', 
                data: {} 
            });
        }
    });
    
    //DELETE
    usersIdRoute.delete(async function(req, res) {
        try {
            const deletedUser = await User.findByIdAndDelete(req.params.id);
            
            if (!deletedUser) {
                return res.status(404).json({ 
                    message: 'User not found',
                    data: {} 
                });
            }

            //two way check
            await Task.updateMany(
                { assignedUser: req.params.id },
                { 
                    assignedUser: '',
                    assignedUserName: 'unassigned'
                }
            );
            
            res.status(200).json({ 
                message: 'User deleted successfully',
                data: deletedUser
            });
        } catch(err) {
            if (err.name === 'CastError') {
                return res.status(404).json({ 
                    message: 'User not found',
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