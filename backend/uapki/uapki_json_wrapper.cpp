#include <iostream>
#include <string>
#include <cstring>
#include <fstream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// UAPKI JSON interface functions
extern "C" {
    char* process(const char* request);
    void json_free(char* buf);
}

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <json_request_file>" << std::endl;
        return 1;
    }

    try {
        // Read JSON request from file
        std::ifstream file(argv[1]);
        if (!file.is_open()) {
            std::cerr << "Failed to open file: " << argv[1] << std::endl;
            return 1;
        }

        std::string request_json((std::istreambuf_iterator<char>(file)),
                                std::istreambuf_iterator<char>());

        json request = json::parse(request_json);
        
        // Check if it's a single request or tasks array
        if (request.contains("tasks")) {
            // Process multiple tasks
            json tasks = request["tasks"];
            for (auto& task : tasks) {
                std::string task_json = task.dump();
                std::cout << "Task: " << task["method"] << std::endl;
                
                char* result = process(task_json.c_str());
                
                if (!result) {
                    std::cerr << "UAPKI process returned null" << std::endl;
                    return 1;
                }

                std::cout << "Response: " << result << std::endl;
                
                json response = json::parse(result);
                
                if (response.contains("errorCode") && response["errorCode"] != 0) {
                    std::cerr << "UAPKI error: " << response["error"] << std::endl;
                    json_free(result);
                    return 1;
                }
                
                json_free(result);
            }
        } else {
            // Single request
            std::cout << "Request: " << request_json << std::endl;
            
            char* result = process(request_json.c_str());
            
            if (!result) {
                std::cerr << "UAPKI process returned null" << std::endl;
                return 1;
            }

            std::cout << "Response: " << result << std::endl;
            
            json response = json::parse(result);
            
            if (response.contains("errorCode") && response["errorCode"] != 0) {
                std::cerr << "UAPKI error: " << response["error"] << std::endl;
                json_free(result);
                return 1;
            }
            
            json_free(result);
        }
        
        std::cout << "Success!" << std::endl;

        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }
}
