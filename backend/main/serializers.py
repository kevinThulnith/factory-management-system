from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Explicitly define the fields you want included
        fields = [
            "id",
            "name",
            "email",
            "username",
            "password",
            "dob",
            "nic",
            "mobile_no",
            "role",
            "department",
        ]
        extra_kwargs = {
            "password": {"write_only": True, "required": True},
            "email": {"required": True},
            "username": {"required": True},
            "name": {"required": True},
        }

    def create(self, validated_data):
        # Use create_user for proper password hashing
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        # Secure password update
        password = validated_data.pop("password", None)

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
