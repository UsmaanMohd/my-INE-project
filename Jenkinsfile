pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-south-1'
        ECR_REPO = 'ine-price-tracker-backend'
        IMAGE_NAME = 'ine-backend'
        CONTAINER_NAME = 'ine-backend'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out latest code from GitHub...'
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building backend Docker image...'

                sh '''
                    docker build \
                      -t ${IMAGE_NAME}:latest \
                      ./backend
                '''
            }
        }

        stage('Login to AWS ECR') {
            steps {
                echo 'Logging in to Amazon ECR...'

                sh '''
                    ACCOUNT_ID=$(aws sts get-caller-identity \
                      --query Account \
                      --output text)

                    ECR_URI=${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}

                    aws ecr get-login-password \
                      --region ${AWS_REGION} | \
                    docker login \
                      --username AWS \
                      --password-stdin ${ECR_URI}
                '''
            }
        }

        stage('Push Image to ECR') {
            steps {
                echo 'Pushing Docker image to ECR...'

                sh '''
                    ACCOUNT_ID=$(aws sts get-caller-identity \
                      --query Account \
                      --output text)

                    ECR_URI=${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}

                    docker tag \
                      ${IMAGE_NAME}:latest \
                      ${ECR_URI}:latest

                    docker push \
                      ${ECR_URI}:latest
                '''
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo 'Deploying latest image to EC2...'

                withCredentials([
                    string(
                        credentialsId: 'supabase-url',
                        variable: 'SUPABASE_URL'
                    ),
                    string(
                        credentialsId: 'supabase-secret-key',
                        variable: 'SUPABASE_SECRET_KEY'
                    ),
                    string(
                        credentialsId: 'cron-secret',
                        variable: 'CRON_SECRET'
                    )
                ]) {

                    sh '''
                        ACCOUNT_ID=$(aws sts get-caller-identity \
                          --query Account \
                          --output text)

                        ECR_URI=${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}

                        echo "Pulling latest image..."
                        docker pull ${ECR_URI}:latest

                        echo "Stopping old container..."
                        docker stop ${CONTAINER_NAME} || true

                        echo "Removing old container..."
                        docker rm ${CONTAINER_NAME} || true

                        echo "Starting new container..."

                        docker run -d \
                          --name ${CONTAINER_NAME} \
                          --restart unless-stopped \
                          -p 5000:5000 \
                          -e SUPABASE_URL="${SUPABASE_URL}" \
                          -e SUPABASE_SECRET_KEY="${SUPABASE_SECRET_KEY}" \
                          -e CRON_SECRET="${CRON_SECRET}" \
                          -e PORT=5000 \
                          ${ECR_URI}:latest

                        echo "Deployment completed."

                        sleep 5

                        docker ps --filter "name=${CONTAINER_NAME}"

                        echo "Health check..."

                        curl --fail \
                          http://localhost:5000/api/health
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '======================================'
            echo 'INE PRICE TRACKER DEPLOYED SUCCESSFULLY'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'DEPLOYMENT FAILED'
            echo 'Check Jenkins console output.'
            echo '======================================'
        }

        always {
            sh '''
                docker image prune -f || true
            '''
        }
    }
}